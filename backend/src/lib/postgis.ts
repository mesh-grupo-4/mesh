import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import type { GeoJsonLineString } from './geo'
import { assertLineString } from './geo'

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

export type MetricaGpsUsuario = {
  usuario_id: string
  distancia_m: number
  segundos_movimiento: number
}

/** Descarta lecturas GPS con más de 100 m de error declarado. */
const PRECISION_MAX_M = 100
/** Bajo este umbral es ruido de un dispositivo quieto, no desplazamiento. */
const SEGMENTO_MIN_M = 1
/** Salto de GPS. Mismo umbral que usa `useTripMetrics` en el frontend. */
const SEGMENTO_MAX_M = 500
/** Hueco largo (app cerrada o sin señal): no interpolamos el tramo faltante. */
const SEGMENTO_MAX_SEG = 120

/**
 * Distancia recorrida y tiempo en movimiento por usuario en un viaje, desde `registro_gps`.
 *
 * Se calcula segmento a segmento con LAG() en lugar de ST_MakeLine porque hace falta
 * descartar outliers: una sola lectura GPS desviada inflaría la línea entera.
 */
export async function computeMetricasGpsPorUsuario(
  prisma: PrismaClient,
  viajeId: string
): Promise<MetricaGpsUsuario[]> {
  return prisma.$queryRaw<MetricaGpsUsuario[]>(
    Prisma.sql`
      WITH puntos AS (
        SELECT
          usuario_id,
          "timestamp",
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS geog
        FROM registro_gps
        WHERE viaje_id = ${viajeId}::uuid
          AND (precision_m IS NULL OR precision_m <= ${PRECISION_MAX_M})
      ),
      segmentos AS (
        SELECT
          usuario_id,
          ST_Distance(geog, LAG(geog) OVER w) AS metros,
          EXTRACT(EPOCH FROM ("timestamp" - LAG("timestamp") OVER w)) AS segundos
        FROM puntos
        WINDOW w AS (PARTITION BY usuario_id ORDER BY "timestamp")
      )
      SELECT
        usuario_id::text                   AS usuario_id,
        COALESCE(SUM(metros), 0)::float8   AS distancia_m,
        COALESCE(SUM(segundos), 0)::float8 AS segundos_movimiento
      FROM segmentos
      WHERE metros IS NOT NULL
        AND metros > ${SEGMENTO_MIN_M}
        AND metros <= ${SEGMENTO_MAX_M}
        AND segundos > 0
        AND segundos <= ${SEGMENTO_MAX_SEG}
      GROUP BY usuario_id
    `
  )
}
