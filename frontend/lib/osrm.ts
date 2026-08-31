import { apiUrl, bearerAuthHeaders } from './apiClient'
import type { GeoJsonLineString } from './viajesTypes'

export type MobilityProfile = 'walking' | 'cycling' | 'driving'

/**
 * El cálculo de ruta lo hace el backend (`POST /api/routing/calcular`), no el
 * dispositivo: React Native en Android (OkHttp) falla de forma intermitente
 * pegándole directo a los demos públicos de OSRM/Valhalla — mismo problema que
 * ya se había resuelto para la búsqueda de lugares en `lib/nominatim.ts`. El
 * backend prueba OSRM y, si no responde, reintenta con Valhalla antes de
 * devolver el error; acá solo hay un salto de red hacia nuestro propio server.
 */
const TIMEOUT_BASE_MS = 15000
const TIMEOUT_MAX_MS = 50000
const TIMEOUT_MS_POR_KM = 200

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

/** El backend puede tardar hasta ~40s probando dos proveedores en rutas largas:
 * el timeout del lado del cliente tiene que darle margen de sobra a eso. */
function timeoutParaRuta(pointsLngLat: [number, number][]): number {
  const km = distanciaHaversineKm(pointsLngLat[0]!, pointsLngLat[pointsLngLat.length - 1]!)
  return Math.min(TIMEOUT_MAX_MS, TIMEOUT_BASE_MS + km * TIMEOUT_MS_POR_KM)
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

type CalcularRutaResponse = {
  linestring: GeoJsonLineString
  distancia_m: number
  duracion_seg: number
}

function kindDesdeRespuesta(status: number, code: string | undefined): OsrmErrorKind {
  if (status === 429 || code === 'ROUTING_RATE_LIMIT') return 'rate_limit'
  if (status === 422 || code === 'ROUTING_NO_ROUTE') return 'no_route'
  if (status === 504 || code === 'ROUTING_TIMEOUT') return 'timeout'
  return 'server'
}

/**
 * Calcula ruta por calles/senderos entre waypoints en orden (lng,lat para OSRM,
 * el mismo orden que usa el resto de este módulo históricamente). Le pega al
 * backend, que internamente decide qué proveedor usar.
 */
export async function calcularRutaOsrm(
  profile: MobilityProfile,
  pointsLngLat: [number, number][]
): Promise<OsrmRouteResult> {
  if (pointsLngLat.length < 2) {
    throw new OsrmError('invalid_input', 'Se necesitan al menos origen y destino')
  }

  const timeoutMs = timeoutParaRuta(pointsLngLat)
  const body = JSON.stringify({
    perfil: profile,
    puntos: pointsLngLat.map(([lng, lat]) => ({ lat, lng })),
  })

  const intentar = async (forceRefresh: boolean): Promise<Response> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const auth = await bearerAuthHeaders(forceRefresh)
      return await fetch(apiUrl('/api/routing/calcular'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body,
        signal: controller.signal,
      })
    } catch (e) {
      // `AbortError` = se venció nuestro timeout esperando al backend; cualquier
      // otra falla acá es que el dispositivo no llega a NUESTRO servidor (no a
      // OSRM/Valhalla, eso ya lo intentó el backend antes de responder).
      if (e instanceof Error && e.name === 'AbortError') {
        throw new OsrmError('timeout', `El servidor no respondió en ${timeoutMs / 1000} s`)
      }
      throw new OsrmError('network', 'No se pudo contactar al servidor')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Mismo patrón de reintento por token vencido que `meshFetchAuthed`, pero con
  // el timeout propio de este endpoint (puede tardar bastante más que el resto
  // de la API porque el backend intenta dos proveedores externos).
  let res = await intentar(false)
  if (res.status === 401) res = await intentar(true)

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new OsrmError(
      kindDesdeRespuesta(res.status, errorBody?.code),
      errorBody?.error ?? `El servidor de rutas respondió HTTP ${res.status}`,
      res.status
    )
  }

  const data = (await res.json()) as CalcularRutaResponse
  const polylineLatLng: [number, number][] = data.linestring.coordinates.map(
    ([lng, lat]): [number, number] => [lat, lng]
  )

  return {
    linestring: data.linestring,
    polylineLatLng,
    distanceM: data.distancia_m,
    durationSec: data.duracion_seg,
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
