import polyline from '@mapbox/polyline'

import { HttpError } from '../../lib/httpError'
import type { GeoJsonLineString } from '../../lib/geo'
import type { CalcularRutaInput, PerfilRuta } from './routing.schemas'

/**
 * Calcula la ruta acá y no en el cliente porque React Native en Android
 * (OkHttp) falla de forma intermitente contra estos demos públicos de OSM
 * — el mismo problema que ya se resolvió para Nominatim en
 * `geocoding.service.ts` (ver el comentario ahí). En Node el fetch saliente
 * es confiable, así que el dispositivo solo habla con nuestro backend.
 */
const OSRM_BASE = 'https://router.project-osrm.org'
const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de'

const TIMEOUT_BASE_MS = 8000
const TIMEOUT_MAX_MS = 20000
const TIMEOUT_MS_POR_KM = 60

const VALHALLA_COSTING: Record<PerfilRuta, string> = {
  driving: 'auto',
  cycling: 'bicycle',
  walking: 'pedestrian',
}

export type RutaCalculada = {
  linestring: GeoJsonLineString
  distancia_m: number
  duracion_seg: number
}

type OsrmResponse = {
  routes?: Array<{ distance: number; duration: number; geometry: string }>
  code?: string
}

type ValhallaResponse = {
  trip?: {
    status: number
    status_message?: string
    summary: { time: number; length: number }
    legs: Array<{ shape: string }>
  }
}

function distanciaHaversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function timeoutParaRuta(puntos: CalcularRutaInput['puntos']): number {
  const km = distanciaHaversineKm(puntos[0]!, puntos[puntos.length - 1]!)
  return Math.min(TIMEOUT_MAX_MS, TIMEOUT_BASE_MS + km * TIMEOUT_MS_POR_KM)
}

/** `AbortError` = venció nuestro timeout; cualquier otra falla de fetch es de red/upstream. */
async function fetchConTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new HttpError(504, 'El servicio de rutas no respondió a tiempo', 'ROUTING_TIMEOUT')
    }
    throw new HttpError(502, 'No se pudo contactar el servicio de rutas', 'ROUTING_UPSTREAM_ERROR')
  } finally {
    clearTimeout(timeoutId)
  }
}

function assertOk(res: Response): void {
  if (res.ok) return
  if (res.status === 429) {
    throw new HttpError(429, 'Demasiados pedidos de ruta, esperá un momento', 'ROUTING_RATE_LIMIT')
  }
  throw new HttpError(502, 'El servicio de rutas respondió con un error', 'ROUTING_UPSTREAM_ERROR')
}

/** Reintentable: la falla fue transitoria (timeout/red/upstream), no un dato de entrada inválido. */
function esReintentable(e: unknown): boolean {
  return (
    e instanceof HttpError &&
    (e.code === 'ROUTING_TIMEOUT' || e.code === 'ROUTING_UPSTREAM_ERROR')
  )
}

async function calcularConOsrm(
  perfil: PerfilRuta,
  puntos: CalcularRutaInput['puntos'],
  timeoutMs: number
): Promise<RutaCalculada> {
  const coordStr = puntos.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${perfil}/${coordStr}?overview=full`

  const res = await fetchConTimeout(url, {}, timeoutMs)
  assertOk(res)

  const json = (await res.json()) as OsrmResponse
  const route = json.routes?.[0]
  if (!route?.geometry) {
    throw new HttpError(422, 'No hay una ruta transitable entre esos puntos', 'ROUTING_NO_ROUTE')
  }

  const decoded = polyline.decode(route.geometry)
  if (decoded.length < 2) {
    throw new HttpError(422, 'No hay una ruta transitable entre esos puntos', 'ROUTING_NO_ROUTE')
  }

  return {
    linestring: { type: 'LineString', coordinates: decoded.map(([lat, lng]): [number, number] => [lng, lat]) },
    distancia_m: route.distance,
    duracion_seg: route.duration,
  }
}

/**
 * Motor de ruteo distinto de OSRM (otro proyecto, otra infraestructura): sirve
 * de respaldo real cuando el demo de OSRM no responde. Decodifica la polyline
 * con precisión 6 (no 5, la que usa OSRM) y devuelve un tramo (`shape`)
 * encodeado por cada leg entre waypoints consecutivos en vez de una única
 * geometría — hay que unirlos, descartando el punto duplicado en cada unión.
 */
async function calcularConValhalla(
  perfil: PerfilRuta,
  puntos: CalcularRutaInput['puntos'],
  timeoutMs: number
): Promise<RutaCalculada> {
  const url = `${VALHALLA_BASE}/route`
  const body = {
    locations: puntos.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: VALHALLA_COSTING[perfil],
  }

  const res = await fetchConTimeout(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    timeoutMs
  )
  assertOk(res)

  const json = (await res.json()) as ValhallaResponse
  const trip = json.trip
  if (!trip || trip.status !== 0 || trip.legs.length === 0) {
    throw new HttpError(422, 'No hay una ruta transitable entre esos puntos', 'ROUTING_NO_ROUTE')
  }

  const coordinates: [number, number][] = []
  for (let i = 0; i < trip.legs.length; i++) {
    const decoded = polyline.decode(trip.legs[i]!.shape, 6)
    const tramo = i === 0 ? decoded : decoded.slice(1)
    for (const [lat, lng] of tramo) coordinates.push([lng, lat])
  }
  if (coordinates.length < 2) {
    throw new HttpError(422, 'No hay una ruta transitable entre esos puntos', 'ROUTING_NO_ROUTE')
  }

  return {
    linestring: { type: 'LineString', coordinates },
    distancia_m: trip.summary.length * 1000,
    duracion_seg: trip.summary.time,
  }
}

type Proveedor = (
  perfil: PerfilRuta,
  puntos: CalcularRutaInput['puntos'],
  timeoutMs: number
) => Promise<RutaCalculada>

const PROVEEDORES: Proveedor[] = [calcularConOsrm, calcularConValhalla]

export class RoutingService {
  /**
   * Prueba cada proveedor una vez; si falla de forma transitoria (timeout o
   * error de upstream), pasa al siguiente antes de rendirse. Son
   * infraestructuras independientes: que una esté caída/lenta no implica que
   * la otra también lo esté. `no_route`/`rate_limit` no valen la pena
   * reintentar en el mismo proveedor, pero sí probar el siguiente.
   */
  async calcularRuta(input: CalcularRutaInput): Promise<RutaCalculada> {
    const timeoutMs = timeoutParaRuta(input.puntos)

    let ultimoError: unknown
    for (const proveedor of PROVEEDORES) {
      try {
        return await proveedor(input.perfil, input.puntos, timeoutMs)
      } catch (e) {
        ultimoError = e
        if (!esReintentable(e) && !(e instanceof HttpError)) throw e
      }
    }
    throw ultimoError
  }
}
