import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import type { GeoJsonLineString } from './geo'
import { assertLineString } from './geo'
import { filtrosGpsPorActividad } from './gpsFilters'

/**
 * Longitud del trazado en metros (elipsoide WGS84) usando PostGIS geography.
 */
export async function computeLineStringLengthMeters(
  prisma: PrismaClient,
  linestring: GeoJsonLineString
): Promise<number> {
  assertLineString(linestring)
  const jsonText = JSON.stringify(linestring)
  const rows = await prisma.$queryRaw<{ len: number }[]>(
    Prisma.sql`
      SELECT ST_Length(
        ST_GeomFromGeoJSON(${jsonText}::text)::geography
      ) AS len
    `
  )
  const len = rows[0]?.len
  if (typeof len !== 'number' || Number.isNaN(len)) {
    throw new Error('No se pudo calcular la longitud de la ruta')
  }
  return len
}

/**
 * Distancia mínima en metros entre un punto y un LineString GeoJSON (RN-034).
 * Devuelve null si la geometría no es válida.
 */
export async function computeDistanciaPuntoARutaM(
  prisma: PrismaClient,
  lat: number,
  lng: number,
  linestring: GeoJsonLineString
): Promise<number | null> {
  try {
    assertLineString(linestring)
  } catch {
    return null
  }
  const jsonText = JSON.stringify(linestring)
  const rows = await prisma.$queryRaw<{ dist_m: number }[]>(
    Prisma.sql`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ST_GeomFromGeoJSON(${jsonText}::text)::geography
      ) AS dist_m
    `
  )
  const dist = rows[0]?.dist_m
  return typeof dist === 'number' && !Number.isNaN(dist) ? dist : null
}

/**
 * Progreso en metros sobre el LineString desde el origen (RN-035).
 * Usa ST_LineLocatePoint × longitud geodésica de la ruta.
 */
export async function computeProgresoEnRutaM(
  prisma: PrismaClient,
  lat: number,
  lng: number,
  linestring: GeoJsonLineString
): Promise<number | null> {
  try {
    assertLineString(linestring)
  } catch {
    return null
  }
  const jsonText = JSON.stringify(linestring)
  const rows = await prisma.$queryRaw<{ progreso_m: number }[]>(
    Prisma.sql`
      SELECT
        ST_LineLocatePoint(
          ST_GeomFromGeoJSON(${jsonText}::text)::geometry,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        ) * ST_Length(ST_GeomFromGeoJSON(${jsonText}::text)::geography) AS progreso_m
    `
  )
  const progreso = rows[0]?.progreso_m
  return typeof progreso === 'number' && !Number.isNaN(progreso) ? progreso : null
}

export type MetricaGpsUsuario = {
  usuario_id: string
  distancia_m: number
  segundos_movimiento: number
  velocidad_maxima_kmh: number | null
}

/** Hueco largo (app cerrada o sin señal): no interpolamos el tramo faltante. */
const SEGMENTO_MAX_SEG = 120
/** Mínimo de segundos por segmento para calcular velocidad (evita ruido GPS). */
const VELOCIDAD_MIN_SEG = 5

async function tipoActividadDelViaje(
  prisma: PrismaClient,
  viajeId: string
): Promise<string> {
  const viaje = await prisma.viaje.findUnique({
    where: { id: viajeId },
    select: { tipo_actividad: true },
  })
  return viaje?.tipo_actividad ?? 'otro'
}

/**
 * Distancia recorrida, tiempo en movimiento y velocidad máxima por usuario en un viaje,
 * calculados segmento a segmento con LAG() para poder descartar outliers GPS.
 */
export type PerfilVelocidadPunto = {
  t_seg: number
  velocidad_kmh: number
}

/**
 * Velocidad promedio por minuto para un usuario en un viaje.
 * Devuelve hasta trip_duration_minutos puntos — apropiado para un gráfico de línea.
 */
export async function computePerfilVelocidad(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string
): Promise<PerfilVelocidadPunto[]> {
  const f = filtrosGpsPorActividad(await tipoActividadDelViaje(prisma, viajeId))
  return prisma.$queryRaw<PerfilVelocidadPunto[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      mintime AS (
        SELECT MIN("timestamp") AS t0 FROM puntos
      ),
      segmentos AS (
        SELECT
          FLOOR(EXTRACT(EPOCH FROM (p."timestamp" - m.t0)) / 60.0)::int AS bucket_min,
          ST_Distance(p.geog, LAG(p.geog) OVER (ORDER BY p."timestamp")) AS metros,
          EXTRACT(EPOCH FROM (p."timestamp" - LAG(p."timestamp") OVER (ORDER BY p."timestamp"))) AS segundos
        FROM puntos p, mintime m
      )
      SELECT
        (bucket_min * 60)::float8       AS t_seg,
        AVG(metros / segundos * 3.6)::float8 AS velocidad_kmh
      FROM segmentos
      WHERE metros IS NOT NULL
        AND metros > ${f.segmentoMinM}
        AND metros <= ${f.segmentoMaxM}
        AND segundos >= ${VELOCIDAD_MIN_SEG}
        AND segundos <= ${SEGMENTO_MAX_SEG}
        AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
      GROUP BY bucket_min
      ORDER BY bucket_min
    `
  )
}

/** Tolerancia de simplificación de la traza, en grados (~11 m en el ecuador). */
const TRAZA_TOLERANCIA_GRADOS = 0.0001

/**
 * Traza GPS recorrida por un usuario en un viaje, como tramos de puntos [lat, lng]
 * ordenados en el tiempo (US2). Cada tramo es contiguo en el tiempo y en el espacio:
 * igual que `computeMetricasGpsPorUsuario`, un hueco temporal largo (app cerrada o
 * sin señal, > SEGMENTO_MAX_SEG) o un salto de distancia imposible entre pings
 * consecutivos (> f.segmentoMaxM) corta la traza en un tramo nuevo en vez de
 * conectar los dos puntos con una línea recta que atraviesa el mapa.
 *
 * Se resuelve con el patrón "gaps and islands": `es_corte` marca el primer punto
 * de cada tramo y `SUM(es_corte) OVER (...)` acumula un `grupo_id` por tramo. Cada
 * tramo se simplifica por separado con ST_SimplifyPreserveTopology para no mandar
 * miles de puntos al mapa: un viaje de 3 h a un ping cada 5 s son ~2160 posiciones,
 * de las que la mayoría no cambia el dibujo de la polilínea.
 */
export async function computeTrazaRecorrido(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string
): Promise<[number, number][][]> {
  const f = filtrosGpsPorActividad(await tipoActividadDelViaje(prisma, viajeId))
  const filas = await prisma.$queryRaw<
    { grupo_id: number; lat: number; lng: number; orden: number }[]
  >(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          lat,
          lng,
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      cortes AS (
        SELECT
          lat,
          lng,
          "timestamp",
          CASE
            WHEN LAG("timestamp") OVER w IS NULL THEN 1
            WHEN ST_Distance(geog, LAG(geog) OVER w) > ${f.segmentoMaxM} THEN 1
            WHEN EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) > ${SEGMENTO_MAX_SEG} THEN 1
            ELSE 0
          END AS es_corte
        FROM puntos
        WINDOW w AS (ORDER BY "timestamp")
      ),
      tramos AS (
        SELECT
          lat,
          lng,
          "timestamp",
          SUM(es_corte) OVER (ORDER BY "timestamp") AS grupo_id
        FROM cortes
      ),
      lineas AS (
        SELECT
          grupo_id,
          ST_SimplifyPreserveTopology(
            ST_MakeLine(ST_SetSRID(ST_MakePoint(lng, lat), 4326) ORDER BY "timestamp"),
            ${TRAZA_TOLERANCIA_GRADOS}
          ) AS geom
        FROM tramos
        GROUP BY grupo_id
        -- ST_MakeLine necesita dos puntos: con uno solo devuelve NULL y no hay traza.
        HAVING COUNT(*) > 1
      )
      SELECT
        lineas.grupo_id::int      AS grupo_id,
        ST_Y(punto.geom)::float8  AS lat,
        ST_X(punto.geom)::float8  AS lng,
        punto.path[1]             AS orden
      FROM lineas, LATERAL ST_DumpPoints(lineas.geom) AS punto
      WHERE lineas.geom IS NOT NULL
      ORDER BY lineas.grupo_id, punto.path[1]
    `
  )

  const segmentos: [number, number][][] = []
  let grupoActual: number | null = null
  let tramoActual: [number, number][] = []
  for (const fila of filas) {
    if (grupoActual === null || fila.grupo_id !== grupoActual) {
      if (tramoActual.length > 0) segmentos.push(tramoActual)
      tramoActual = []
      grupoActual = fila.grupo_id
    }
    tramoActual.push([fila.lat, fila.lng])
  }
  if (tramoActual.length > 0) segmentos.push(tramoActual)
  return segmentos
}

export type PuntoFantasma = {
  /** Segundos desde el primer punto de la traza. */
  t_seg: number
  lat: number
  lng: number
  /** Metros acumulados (solo segmentos válidos). */
  d_m: number
}

/**
 * RN-073: traza de un integrante en un viaje finalizado, con tiempo y distancia
 * acumulados por punto, para animar un fantasma. Mismos filtros que las métricas;
 * se submuestrea a `maxPuntos` conservando primer y último punto.
 */
export async function computeTrazaFantasma(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string,
  maxPuntos: number
): Promise<PuntoFantasma[]> {
  const f = filtrosGpsPorActividad(await tipoActividadDelViaje(prisma, viajeId))
  const filas = await prisma.$queryRaw<{ t_seg: number; lat: number; lng: number; d_m: number }[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          lat, lng, "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          lat, lng, "timestamp",
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos
        FROM puntos
        WINDOW w AS (ORDER BY "timestamp")
      ),
      acumulado AS (
        SELECT
          lat, lng, "timestamp",
          SUM(
            CASE
              WHEN metros IS NOT NULL AND metros > ${f.segmentoMinM} AND metros <= ${f.segmentoMaxM}
                   AND segundos > 0 AND segundos <= ${SEGMENTO_MAX_SEG}
                   AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
              THEN metros ELSE 0
            END
          ) OVER (ORDER BY "timestamp") AS d_m,
          EXTRACT(EPOCH FROM ("timestamp" - FIRST_VALUE("timestamp") OVER (ORDER BY "timestamp"))) AS t_seg,
          ROW_NUMBER() OVER (ORDER BY "timestamp") AS n,
          COUNT(*) OVER () AS total
        FROM segmentos
      )
      SELECT t_seg::float8 AS t_seg, lat::float8 AS lat, lng::float8 AS lng, d_m::float8 AS d_m
      FROM acumulado
      WHERE n = 1 OR n = total OR (n % GREATEST(1, CEIL(total::float8 / ${maxPuntos})::int)) = 0
      ORDER BY "timestamp"
    `
  )
  return filas.map((r) => ({ t_seg: Number(r.t_seg), lat: Number(r.lat), lng: Number(r.lng), d_m: Number(r.d_m) }))
}

export type SplitKm = {
  /** Kilómetro 1, 2, 3… El último puede ser parcial (`metros < 1000`). */
  km: number
  metros: number
  segundos: number
}

/**
 * RN-065 (métricas de entrenamiento): tiempo por kilómetro recorrido. Usa los
 * mismos filtros de segmentos válidos que las métricas de cierre, acumula la
 * distancia en orden temporal y agrupa por kilómetro completado.
 */
export async function computeSplitsPorKm(
  prisma: PrismaClient,
  viajeId: string,
  usuarioId: string
): Promise<SplitKm[]> {
  const f = filtrosGpsPorActividad(await tipoActividadDelViaje(prisma, viajeId))
  const filas = await prisma.$queryRaw<{ km: number; metros: number; segundos: number }[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          "timestamp",
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos
        FROM puntos
        WINDOW w AS (ORDER BY "timestamp")
      ),
      validos AS (
        SELECT *
        FROM segmentos
        WHERE metros IS NOT NULL
          AND metros > ${f.segmentoMinM}
          AND metros <= ${f.segmentoMaxM}
          AND segundos > 0
          AND segundos <= ${SEGMENTO_MAX_SEG}
          AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
      ),
      acumulado AS (
        SELECT
          metros,
          segundos,
          SUM(metros) OVER (ORDER BY "timestamp") AS metros_acum
        FROM validos
      )
      SELECT
        CEIL(metros_acum / 1000.0)::int        AS km,
        SUM(metros)::float8                    AS metros,
        SUM(segundos)::float8                  AS segundos
      FROM acumulado
      GROUP BY 1
      ORDER BY 1
    `
  )
  return filas.map((r) => ({ km: Number(r.km), metros: Number(r.metros), segundos: Number(r.segundos) }))
}

export async function computeMetricasGpsPorUsuario(
  prisma: PrismaClient,
  viajeId: string
): Promise<MetricaGpsUsuario[]> {
  const f = filtrosGpsPorActividad(await tipoActividadDelViaje(prisma, viajeId))
  return prisma.$queryRaw<MetricaGpsUsuario[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          usuario_id,
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          usuario_id,
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos
        FROM puntos
        WINDOW w AS (PARTITION BY usuario_id ORDER BY "timestamp")
      ),
      validos AS (
        SELECT *
        FROM segmentos
        WHERE metros IS NOT NULL
          AND metros > ${f.segmentoMinM}
          AND metros <= ${f.segmentoMaxM}
          AND segundos > 0
          AND segundos <= ${SEGMENTO_MAX_SEG}
          AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
      )
      SELECT
        usuario_id::text                        AS usuario_id,
        COALESCE(SUM(metros), 0)::float8        AS distancia_m,
        COALESCE(SUM(segundos), 0)::float8      AS segundos_movimiento,
        MAX(
          CASE WHEN segundos >= ${VELOCIDAD_MIN_SEG}
               AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
               THEN metros / segundos * 3.6
               ELSE NULL
          END
        )::float8                               AS velocidad_maxima_kmh
      FROM validos
      GROUP BY usuario_id
    `
  )
}
