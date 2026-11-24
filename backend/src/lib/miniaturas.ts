import { Prisma, type PrismaClient } from '@prisma/client'

/**
 * Trazados simplificados para las miniaturas de mapa de los listados (rutas guardadas y
 * viajes). Coordenadas GeoJSON [lng, lat] con 5 decimales, en el orden del recorrido.
 *
 * La tolerancia de `ST_SimplifyPreserveTopology` es relativa al tamaño de cada ruta
 * (1/MINIATURA_RESOLUCION del lado más largo de su caja): una vuelta corta y un viaje de
 * 300 km quedan con una cantidad parecida de puntos, suficiente para un cuadro de ~100 px.
 * No sirven para navegar ni para calcular nada: para eso está el trazado completo.
 */
export type CoordsMiniatura = [number, number][]

export const MINIATURA_RESOLUCION = 80

/**
 * Precisión GPS máxima de los pings que entran en la miniatura de un recorrido. Es la más
 * permisiva de `filtrosGpsPorActividad`: alcanza para descartar los saltos que deformarían
 * el encuadre sin depender de la actividad de cada viaje del listado.
 */
const PRECISION_MAX_MINIATURA_M = 50

/** Expresión SQL con las coordenadas simplificadas de `geom` (una geometría 4326). */
function coordsSimplificadas(geom: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    (ST_AsGeoJSON(
      ST_SimplifyPreserveTopology(
        ${geom},
        GREATEST(ST_XMax(${geom}) - ST_XMin(${geom}), ST_YMax(${geom}) - ST_YMin(${geom}))
          / ${MINIATURA_RESOLUCION}::float8
      ),
      5
    )::json) -> 'coordinates'`
}

function aMapa(filas: { id: string; coords: CoordsMiniatura | null }[]) {
  return new Map(filas.map((f) => [f.id, f.coords ?? []]))
}

/**
 * Filtra trazados GeoJSON guardados en una columna jsonb: solo LineString de al menos dos
 * puntos, para que `ST_GeomFromGeoJSON` no falle con un dato incompleto.
 */
const LINESTRING_VALIDA = Prisma.sql`
  linestring_geojson->>'type' = 'LineString'
  AND jsonb_array_length(linestring_geojson->'coordinates') >= 2`

/** Miniaturas de las rutas guardadas (plantillas) de un usuario, por id de plantilla. */
export async function miniaturasDePlantillas(
  prisma: PrismaClient,
  usuarioId: string
): Promise<Map<string, CoordsMiniatura>> {
  const filas = await prisma.$queryRaw<{ id: string; coords: CoordsMiniatura | null }[]>(
    Prisma.sql`
      WITH g AS (
        SELECT id, ST_GeomFromGeoJSON(linestring_geojson::text) AS geom
        FROM ruta_plantilla
        WHERE usuario_id = ${usuarioId}::uuid AND ${LINESTRING_VALIDA}
      )
      SELECT id::text AS id, ${coordsSimplificadas(Prisma.sql`geom`)} AS coords FROM g
    `
  )
  return aMapa(filas)
}

/** Miniaturas de la ruta planificada de cada viaje, por id de viaje. Sin ruta, no aparece. */
export async function miniaturasDeRutasPlanificadas(
  prisma: PrismaClient,
  viajeIds: string[]
): Promise<Map<string, CoordsMiniatura>> {
  if (viajeIds.length === 0) return new Map()
  const filas = await prisma.$queryRaw<{ id: string; coords: CoordsMiniatura | null }[]>(
    Prisma.sql`
      WITH g AS (
        SELECT viaje_id, ST_GeomFromGeoJSON(linestring_geojson::text) AS geom
        FROM ruta
        WHERE viaje_id = ANY(${viajeIds}::uuid[]) AND ${LINESTRING_VALIDA}
      )
      SELECT viaje_id::text AS id, ${coordsSimplificadas(Prisma.sql`geom`)} AS coords FROM g
    `
  )
  return aMapa(filas)
}

/**
 * Miniaturas del recorrido real de un usuario en cada viaje (su propia traza GPS), por id
 * de viaje. Una sola consulta para todo el listado. Es una vista de los propios datos: no
 * pasa por el compartir ubicación (RN-111) ni deja registro de acceso (RN-112), igual que
 * la traza del resumen. A diferencia de esa traza no corta en tramos por huecos de señal:
 * en un cuadro de 100 px no se nota y simplifica la consulta.
 */
export async function miniaturasDeRecorridos(
  prisma: PrismaClient,
  usuarioId: string,
  viajeIds: string[]
): Promise<Map<string, CoordsMiniatura>> {
  if (viajeIds.length === 0) return new Map()
  const filas = await prisma.$queryRaw<{ id: string; coords: CoordsMiniatura | null }[]>(
    Prisma.sql`
      WITH lineas AS (
        SELECT
          viaje_id,
          ST_MakeLine(ST_SetSRID(ST_MakePoint(lng, lat), 4326) ORDER BY "timestamp") AS geom
        FROM registro_gps
        WHERE usuario_id = ${usuarioId}::uuid
          AND viaje_id = ANY(${viajeIds}::uuid[])
          AND (precision_m IS NULL OR precision_m <= ${PRECISION_MAX_MINIATURA_M})
        GROUP BY viaje_id
        HAVING COUNT(*) > 1
      )
      SELECT viaje_id::text AS id, ${coordsSimplificadas(Prisma.sql`geom`)} AS coords
      FROM lineas
      WHERE geom IS NOT NULL
    `
  )
  return aMapa(filas)
}
