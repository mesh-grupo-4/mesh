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

/** Timeout del pedido: el demo público a veces cuelga la conexión sin responder. */
const OSRM_TIMEOUT_MS = 15000

export type OsrmErrorKind =
  | 'invalid_input'
  | 'timeout'
  | 'network'
  | 'rate_limit'
  | 'server'
  | 'no_route'

/** Error tipado para poder mostrarle al usuario la causa real y no un genérico. */
export class OsrmError extends Error {
  constructor(
    public readonly kind: OsrmErrorKind,
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'OsrmError'
  }
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
    throw new OsrmError('invalid_input', 'Se necesitan al menos origen y destino')
  }

  const coordStr = pointsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${profile}/${coordStr}?overview=full`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal })
  } catch (e) {
    // `AbortError` = se venció nuestro timeout; cualquier otra falla de fetch es red.
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OsrmError('timeout', `El servidor de rutas no respondió en ${OSRM_TIMEOUT_MS / 1000} s`)
    }
    throw new OsrmError('network', 'No se pudo contactar al servidor de rutas')
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new OsrmError('rate_limit', 'Demasiados pedidos al servidor de rutas', res.status)
    }
    throw new OsrmError('server', `El servidor de rutas respondió HTTP ${res.status}`, res.status)
  }

  const json = (await res.json()) as OsrmResponse
  const route = json.routes?.[0]
  if (!route?.geometry) {
    throw new OsrmError('no_route', `Sin ruta transitable (code: ${json.code ?? 'desconocido'})`)
  }

  const decoded = polyline.decode(route.geometry)
  if (decoded.length < 2) {
    throw new OsrmError('no_route', 'La ruta devuelta no tiene suficientes puntos')
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
  tipo: 'moto' | 'bici' | 'running' | 'trekking' | 'otro'
): MobilityProfile {
  switch (tipo) {
    case 'moto':
      return 'driving'
    case 'bici':
      return 'cycling'
    case 'running':
    case 'trekking':
    case 'otro':
      return 'walking'
    default:
      return 'walking'
  }
}
