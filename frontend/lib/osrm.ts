import polyline from '@mapbox/polyline'

import type { GeoJsonLineString } from './viajesTypes'

export type MobilityProfile = 'walking' | 'cycling' | 'driving'

/** Demo público OSRM — solo para desarrollo/MVP; en producción conviene instancia propia. */
const OSRM_BASE = 'https://router.project-osrm.org'

export type OsrmRouteResult = {
  linestring: GeoJsonLineString
  /** Coordenadas [lat, lng][] para react-native-maps Polyline */
  polylineLatLng: [number, number][]
  distanceM: number
  durationSec: number
}

type OsrmResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry: string
  }>
  code?: string
}

/**
 * Calcula ruta por calles/senderos entre waypoints en orden (lng,lat para OSRM).
 * Decodifica la polyline encoded con @mapbox/polyline.
 */
export async function calcularRutaOsrm(
  profile: MobilityProfile,
  pointsLngLat: [number, number][]
): Promise<OsrmRouteResult> {
  if (pointsLngLat.length < 2) {
    throw new Error('Se necesitan al menos origen y destino')
  }

  const coordStr = pointsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${profile}/${coordStr}?overview=full`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('OSRM_HTTP_ERROR')
  }

  const json = (await res.json()) as OsrmResponse
  const route = json.routes?.[0]
  if (!route?.geometry) {
    throw new Error('OSRM_NO_ROUTE')
  }

  const decoded = polyline.decode(route.geometry)
  if (decoded.length < 2) {
    throw new Error('OSRM_NO_ROUTE')
  }

  const coordinates: [number, number][] = decoded.map(([lat, lng]) => [lng, lat])
  const polylineLatLng: [number, number][] = decoded.map(([lat, lng]) => [lat, lng])

  return {
    linestring: {
      type: 'LineString',
      coordinates,
    },
    polylineLatLng,
    distanceM: route.distance,
    durationSec: route.duration,
  }
}

/** Mapea tipo de actividad del viaje al perfil OSRM más cercano. */
export function perfilOsrmDesdeActividad(
  tipo: 'moto' | 'bici' | 'running' | 'trekking'
): MobilityProfile {
  switch (tipo) {
    case 'moto':
      return 'driving'
    case 'bici':
      return 'cycling'
    case 'running':
    case 'trekking':
      return 'walking'
    default:
      return 'walking'
  }
}
