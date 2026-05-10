/**
 * Contrato geoespacial API ↔ PostGIS (MVP iniciar salida)
 *
 * - Puntos: GeoJSON RFC 7946 `Point` con `coordinates: [lng, lat]` (orden obligatorio).
 * - Trazado: GeoJSON `LineString` con al menos 2 vértices `[lng, lat]`.
 *
 * Persistencia en DB:
 * - Coordenadas escalares (`origen_*`, `destino_*`, paradas) para CRUD con Prisma.
 * - `linestring_geojson` (Json) como fuente de verdad del trazado; la distancia planeada
 *   se calcula en PostGIS vía `ST_Length(geom::geography)` sobre `ST_GeomFromGeoJSON`.
 */

export type GeoJsonPoint = {
  type: 'Point'
  coordinates: [number, number]
}

export type GeoJsonLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export function assertPoint(p: GeoJsonPoint): void {
  if (p.type !== 'Point' || !Array.isArray(p.coordinates) || p.coordinates.length !== 2) {
    throw new Error('Punto GeoJSON inválido')
  }
}

export function assertLineString(ls: GeoJsonLineString): void {
  if (ls.type !== 'LineString' || !Array.isArray(ls.coordinates) || ls.coordinates.length < 2) {
    throw new Error('LineString GeoJSON inválido')
  }
}
