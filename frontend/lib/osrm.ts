import polyline from '@mapbox/polyline'

import type { GeoJsonLineString } from './viajesTypes'

export type MobilityProfile = 'walking' | 'cycling' | 'driving'

/** Demo público OSRM — solo para desarrollo/MVP; en producción conviene instancia propia. */
const OSRM_BASE = 'https://router.project-osrm.org'

/**
 * El demo público tarda más cuanto más larga es la ruta (más nodos a explorar,
 * sobre todo en los perfiles walking/cycling). Un timeout fijo corto hace que
 * rutas largas fallen seguido y, peor, un reset de conexión del lado del
 * servidor por tardar demasiado se reporta como error de "red" (no como
 * timeout), lo cual termina mostrándole al usuario un mensaje de "sin
 * internet" incorrecto. Escalamos el timeout según la distancia en línea
 * recta entre el primer y el último punto.
 */
const OSRM_TIMEOUT_BASE_MS = 20000
const OSRM_TIMEOUT_MAX_MS = 45000
const OSRM_TIMEOUT_MS_POR_KM = 150

/** Fallas transitorias: vale la pena reintentar antes de rendirse. */
const OSRM_MAX_REINTENTOS = 2
const OSRM_ESPERA_ENTRE_REINTENTOS_MS = 1500

function distanciaHaversineKm(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function timeoutParaRuta(pointsLngLat: [number, number][]): number {
  const km = distanciaHaversineKm(pointsLngLat[0], pointsLngLat[pointsLngLat.length - 1])
  return Math.min(OSRM_TIMEOUT_MAX_MS, OSRM_TIMEOUT_BASE_MS + km * OSRM_TIMEOUT_MS_POR_KM)
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type OsrmRouteResult = {
  linestring: GeoJsonLineString
  /** Coordenadas [lat, lng][] para dibujar la polyline en el mapa */
  polylineLatLng: [number, number][]
  distanceM: number
  durationSec: number
}

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

/** Un solo intento de pedido a OSRM, sin reintentos. */
async function intentarCalcularRutaOsrm(
  profile: MobilityProfile,
  pointsLngLat: [number, number][],
  timeoutMs: number
): Promise<OsrmRouteResult> {
  const coordStr = pointsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${profile}/${coordStr}?overview=full`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal })
  } catch (e) {
    // `AbortError` = se venció nuestro timeout; cualquier otra falla de fetch puede ser
    // tanto falta de red del dispositivo como el servidor cortando la conexión por
    // tardar demasiado en resolver una ruta larga — no asumimos cuál de las dos es.
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OsrmError('timeout', `El servidor de rutas no respondió en ${timeoutMs / 1000} s`)
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

/** Fallas transitorias del demo público: vale la pena reintentar antes de rendirse. */
function esReintentable(e: unknown): boolean {
  return e instanceof OsrmError && (e.kind === 'network' || e.kind === 'timeout' || e.kind === 'server')
}

/**
 * Calcula ruta por calles/senderos entre waypoints en orden (lng,lat para OSRM).
 * Decodifica la polyline encoded con @mapbox/polyline.
 *
 * El timeout escala con la distancia del recorrido y, ante fallas transitorias
 * (red, timeout o error de servidor), reintenta antes de rendirse: el demo
 * público suele fallar así en rutas largas y no significa que el dispositivo
 * esté sin internet.
 */
export async function calcularRutaOsrm(
  profile: MobilityProfile,
  pointsLngLat: [number, number][]
): Promise<OsrmRouteResult> {
  if (pointsLngLat.length < 2) {
    throw new OsrmError('invalid_input', 'Se necesitan al menos origen y destino')
  }

  const timeoutMs = timeoutParaRuta(pointsLngLat)

  let ultimoError: unknown
  for (let intento = 0; intento <= OSRM_MAX_REINTENTOS; intento++) {
    try {
      return await intentarCalcularRutaOsrm(profile, pointsLngLat, timeoutMs)
    } catch (e) {
      ultimoError = e
      if (!esReintentable(e) || intento === OSRM_MAX_REINTENTOS) {
        throw e
      }
      await esperar(OSRM_ESPERA_ENTRE_REINTENTOS_MS)
    }
  }
  throw ultimoError
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
