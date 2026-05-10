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
