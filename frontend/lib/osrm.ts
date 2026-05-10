import type { GeoJsonLineString } from './viajesTypes'

export type MobilityProfile = 'walking' | 'cycling' | 'driving'

/** Demo público OSRM — solo para desarrollo/MVP; en producción conviene instancia propia. */
const OSRM_BASE = 'https://router.project-osrm.org'

export type OsrmRouteResult = {
  linestring: GeoJsonLineString
  distanceM: number
  durationSec: number
}

type OsrmResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry: {
      type: string
      coordinates: [number, number][]
    }
  }>
  code?: string
}

/**
 * Calcula ruta por calles/senderos entre waypoints en orden (lng,lat para OSRM).
 */
export async function calcularRutaOsrm(
  profile: MobilityProfile,
  pointsLngLat: [number, number][]
): Promise<OsrmRouteResult> {
  if (pointsLngLat.length < 2) {
    throw new Error('Se necesitan al menos origen y destino')
  }

  const coordStr = pointsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('OSRM_HTTP_ERROR')
  }

  const json = (await res.json()) as OsrmResponse
  const route = json.routes?.[0]
  if (!route || route.geometry?.type !== 'LineString' || !route.geometry.coordinates?.length) {
    throw new Error('OSRM_NO_ROUTE')
  }

  const coordinates = route.geometry.coordinates
  if (coordinates.length < 2) {
    throw new Error('OSRM_NO_ROUTE')
  }

  return {
    linestring: {
      type: 'LineString',
      coordinates,
    },
    distanceM: route.distance,
    durationSec: route.duration,
  }
}
