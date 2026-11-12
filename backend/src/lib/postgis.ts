import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import type { GeoJsonLineString } from './geo'
import { assertLineString } from './geo'
import { DISTANCIA_MINIMA_M, filtrosGpsPorActividad, RADIO_QUIETO_M } from './gpsFilters'
import {
  calcularAltimetria,
  PRECISION_ALTITUD_MAX_M,
  VENTANA_SUAVIZADO_SEG,
  type Altimetria,
} from './altimetria'

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

/**
 * Fracción (0..1) de cada punto proyectado sobre el LineString (ST_LineLocatePoint),
 * en el mismo orden en que llegan. Sirve para saber qué tramo de la ruta ya quedó atrás.
 */
export async function computeFraccionesEnRuta(
  prisma: PrismaClient,
  linestring: GeoJsonLineString,
  puntos: { lat: number; lng: number }[]
): Promise<number[]> {
  assertLineString(linestring)
  if (puntos.length === 0) return []
  const jsonText = JSON.stringify(linestring)
  const lats = puntos.map((p) => p.lat)
  const lngs = puntos.map((p) => p.lng)
  const rows = await prisma.$queryRaw<{ orden: number; fraccion: number }[]>(
    Prisma.sql`
      SELECT
        p.orden::int AS orden,
        ST_LineLocatePoint(
          ST_GeomFromGeoJSON(${jsonText}::text)::geometry,
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)
        )::float8 AS fraccion
      FROM unnest(${lats}::float8[], ${lngs}::float8[]) WITH ORDINALITY AS p(lat, lng, orden)
      ORDER BY p.orden
    `
  )
  return rows.map((r) => Number(r.fraccion))
}

/**
 * RN-034b: une el tramo de la ruta vieja que ya se recorrió (desde el origen hasta
 * `fraccionCorte`) con el tramo nuevo que calculó el ruteo. Así quien todavía viene
 * por detrás sobre el trazado original no queda "desviado" por el recálculo.
 */
export async function unirTramoRecorridoConNuevo(
  prisma: PrismaClient,
  rutaVieja: GeoJsonLineString,
  fraccionCorte: number,
  tramoNuevo: GeoJsonLineString
): Promise<{ linestring: GeoJsonLineString; longitudM: number }> {
  assertLineString(rutaVieja)
  assertLineString(tramoNuevo)
  const fraccion = Math.min(1, Math.max(0, fraccionCorte))
  const rows = await prisma.$queryRaw<{ geojson: string; len: number }[]>(
    Prisma.sql`
      WITH unida AS (
        SELECT ST_MakeLine(
          ST_LineSubstring(ST_GeomFromGeoJSON(${JSON.stringify(rutaVieja)}::text), 0, ${fraccion}::float8),
          ST_GeomFromGeoJSON(${JSON.stringify(tramoNuevo)}::text)
        ) AS g
      )
      SELECT ST_AsGeoJSON(g) AS geojson, ST_Length(g::geography)::float8 AS len FROM unida
    `
  )
  const fila = rows[0]
  if (!fila?.geojson || typeof fila.len !== 'number' || Number.isNaN(fila.len)) {
    throw new Error('No se pudo unir la ruta recalculada')
  }
  const linestring = JSON.parse(fila.geojson) as GeoJsonLineString
  assertLineString(linestring)
  return { linestring, longitudM: fila.len }
}

export type MetricaGpsUsuario = {
  usuario_id: string
  distancia_m: number
  segundos_movimiento: number
  velocidad_maxima_kmh: number | null
} & Partial<Altimetria>

/** Hueco largo (app cerrada o sin señal): no interpolamos el tramo faltante. */
const SEGMENTO_MAX_SEG = 120
/** Mínimo de segundos por segmento para calcular velocidad (evita ruido GPS). */
const VELOCIDAD_MIN_SEG = 5
/**
 * Velocidad del chip GPS "sostenida": se toma el mínimo entre dos muestras
 * consecutivas separadas como mucho por estos segundos. Así un pico aislado
 * (rebote en un túnel, entre edificios) no queda como velocidad máxima.
 */
const VELOCIDAD_SOSTENIDA_MAX_SEG = 30

/**
 * Piezas compartidas por todo cálculo de movimiento, para que el resumen, los splits,
 * el perfil de velocidad y el fantasma coincidan. Requieren `usuario_id`, `"timestamp"`,
 * `geog` y `precision_m` en el CTE de puntos, y `metros` junto a `neto_m` al filtrar.
 */
const NETO_M = Prisma.sql`ST_Distance(FIRST_VALUE(geog) OVER neto, LAST_VALUE(geog) OVER neto) AS neto_m`
const VENTANA_NETO = Prisma.sql`neto AS (
  PARTITION BY usuario_id ORDER BY "timestamp"
  RANGE BETWEEN INTERVAL '30 seconds' PRECEDING AND INTERVAL '30 seconds' FOLLOWING
)`
// El tramo propio cubre pings espaciados más que la ventana. La precisión declarada sube
// el radio: con 30 m de error, moverse 25 m no se distingue del ruido.
const ES_MOVIMIENTO = Prisma.sql`GREATEST(neto_m, metros) >= GREATEST(${RADIO_QUIETO_M}::float8, COALESCE(precision_m, 0))`

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
          usuario_id,
          precision_m,
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
          precision_m,
          FLOOR(EXTRACT(EPOCH FROM (p."timestamp" - m.t0)) / 60.0)::int AS bucket_min,
          ST_Distance(p.geog, LAG(p.geog) OVER (ORDER BY p."timestamp")) AS metros,
          EXTRACT(EPOCH FROM (p."timestamp" - LAG(p."timestamp") OVER (ORDER BY p."timestamp"))) AS segundos,
          ${NETO_M}
        FROM puntos p, mintime m
        WINDOW ${VENTANA_NETO}
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
        AND ${ES_MOVIMIENTO}
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
          usuario_id, precision_m,
          lat, lng, "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          precision_m,
          lat, lng, "timestamp",
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos,
          ${NETO_M}
        FROM puntos
        WINDOW w AS (ORDER BY "timestamp"), ${VENTANA_NETO}
      ),
      acumulado AS (
        SELECT
          lat, lng, "timestamp",
          SUM(
            CASE
              WHEN metros IS NOT NULL AND metros > ${f.segmentoMinM} AND metros <= ${f.segmentoMaxM}
                   AND segundos > 0 AND segundos <= ${SEGMENTO_MAX_SEG}
                   AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
                   AND ${ES_MOVIMIENTO}
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
          usuario_id,
          precision_m,
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND usuario_id = ${usuarioId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          precision_m,
          "timestamp",
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos,
          ${NETO_M}
        FROM puntos
        WINDOW w AS (ORDER BY "timestamp"), ${VENTANA_NETO}
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
          AND ${ES_MOVIMIENTO}
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
  const metricas = await prisma.$queryRaw<MetricaGpsUsuario[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          usuario_id,
          precision_m,
          "timestamp",
          velocidad_kmh,
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${f.precisionMaxM})
      ),
      segmentos AS (
        SELECT
          usuario_id,
          precision_m,
          ${NETO_M},
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos,
          -- LEAST ignora NULL en Postgres: sin el CASE, una sola muestra con
          -- velocidad pasaría como "sostenida".
          CASE
            WHEN velocidad_kmh IS NOT NULL AND LAG(velocidad_kmh) OVER w IS NOT NULL
            THEN LEAST(velocidad_kmh, LAG(velocidad_kmh) OVER w)
          END AS vel_sostenida_kmh
        FROM puntos
        WINDOW w AS (PARTITION BY usuario_id ORDER BY "timestamp"), ${VENTANA_NETO}
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
          AND ${ES_MOVIMIENTO}
      ),
      por_distancia AS (
        SELECT
          usuario_id,
          COALESCE(SUM(metros), 0)                AS distancia_m,
          COALESCE(SUM(segundos), 0)              AS segundos_movimiento,
          MAX(
            CASE WHEN segundos >= ${VELOCIDAD_MIN_SEG}
                 AND (metros / segundos * 3.6) <= ${f.velocidadMaxKmh}
                 THEN metros / segundos * 3.6
                 ELSE NULL
            END
          )                                       AS velocidad_maxima_calc_kmh
        FROM validos
        GROUP BY usuario_id
      ),
      por_dispositivo AS (
        SELECT usuario_id, MAX(vel_sostenida_kmh) AS velocidad_maxima_chip_kmh
        FROM segmentos
        WHERE vel_sostenida_kmh IS NOT NULL
          AND segundos > 0
          AND segundos <= ${VELOCIDAD_SOSTENIDA_MAX_SEG}
          AND vel_sostenida_kmh <= ${f.velocidadMaxKmh}
        GROUP BY usuario_id
      )
      SELECT
        d.usuario_id::text                      AS usuario_id,
        d.distancia_m::float8                   AS distancia_m,
        d.segundos_movimiento::float8           AS segundos_movimiento,
        -- La velocidad del chip GPS es más precisa; la derivada de las
        -- posiciones queda para apps viejas o dispositivos que no la informan.
        COALESCE(c.velocidad_maxima_chip_kmh, d.velocidad_maxima_calc_kmh)::float8
                                                AS velocidad_maxima_kmh
      FROM por_distancia d
      LEFT JOIN por_dispositivo c ON c.usuario_id = d.usuario_id
    `
  )

  // Sin recorrido real no hay fila: mejor "sin datos" que un ritmo inventado sobre ruido.
  const conRecorrido = metricas.filter((m) => m.distancia_m >= DISTANCIA_MINIMA_M)
  if (conRecorrido.length === 0) return []

  const alturas = await computeAlturasSuavizadasPorUsuario(prisma, viajeId, f.precisionMaxM)
  return conRecorrido.map((m) => {
    const altimetria = calcularAltimetria(alturas.get(m.usuario_id) ?? [])
    return altimetria ? { ...m, ...altimetria } : m
  })
}

/**
 * Serie de altitud por integrante, en orden temporal y suavizada en la base:
 * mediana por ventana de `VENTANA_SUAVIZADO_SEG`, solo con muestras cuya
 * precisión vertical sea aceptable. Reduce además el volumen que viaja a Node
 * (una fila cada 30 s en vez de una cada 5 s).
 */
async function computeAlturasSuavizadasPorUsuario(
  prisma: PrismaClient,
  viajeId: string,
  precisionMaxM: number
): Promise<Map<string, number[]>> {
  const filas = await prisma.$queryRaw<{ usuario_id: string; altitud_m: number }[]>(
    Prisma.sql`
      SELECT
        usuario_id::text AS usuario_id,
        FLOOR(EXTRACT(EPOCH FROM "timestamp") / ${VENTANA_SUAVIZADO_SEG}) AS ventana,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY altitud_m)::float8 AS altitud_m
      FROM registro_gps
      WHERE viaje_id = ${viajeId}::uuid
        AND altitud_m IS NOT NULL
        AND precision_altitud_m > 0
        AND precision_altitud_m <= ${PRECISION_ALTITUD_MAX_M}
        AND (precision_m IS NULL OR precision_m <= ${precisionMaxM})
      GROUP BY usuario_id, ventana
      ORDER BY usuario_id, ventana
    `
  )
  const porUsuario = new Map<string, number[]>()
  for (const r of filas) {
    const serie = porUsuario.get(r.usuario_id) ?? []
    serie.push(Number(r.altitud_m))
    porUsuario.set(r.usuario_id, serie)
  }
  return porUsuario
}
