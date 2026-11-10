import * as Crypto from 'expo-crypto'

import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/**
 * Búsqueda de lugares y geocodificación inversa — proxiadas por el backend
 * (`/api/geocoding/...`), que le pega a Google Places/Geocoding (o a
 * Nominatim/OpenStreetMap de respaldo) del lado del servidor. Antes se llamaba a Nominatim directo desde el dispositivo, pero
 * React Native en Android (OkHttp) ignora el `User-Agent` seteado a mano vía
 * `fetch()` y Nominatim exige uno identificable — sin él responde 403 siempre,
 * lo que se veía como "sin conexión" al buscar.
 */
export type LugarHit = {
  nombre: string
  lat: number
  lng: number
}

/**
 * Sugerencia mientras se escribe. Las de Google (autocompletado) traen
 * `placeId` y no traen coordenadas: se resuelven con `resolverSugerencia`
 * recién cuando el usuario elige una. Las del respaldo ya vienen con `lat`/`lng`.
 */
export type LugarSugerencia = {
  nombre: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

/** Desde cuántas letras se piden sugerencias. */
export const MIN_LETRAS_SUGERENCIAS = 2

// Token de sesión de Google Places: se comparte entre todos los pedidos de un
// mismo tipeo y se cierra al resolver el lugar elegido, así la sesión entera
// se cobra como una sola consulta. Hay un solo buscador activo a la vez.
let sesion: string | null = null

export async function sugerirLugares(
  query: string,
  cerca?: { lat: number; lng: number } | null
): Promise<LugarSugerencia[]> {
  const q = query.trim()
  if (q.length < MIN_LETRAS_SUGERENCIAS) return []

  sesion ??= Crypto.randomUUID()
  const params = new URLSearchParams({ q, sesion })
  if (cerca) {
    params.set('lat', String(cerca.lat))
    params.set('lng', String(cerca.lng))
  }
  const res = await meshFetchAuthed(apiUrl(`/api/geocoding/autocompletar?${params.toString()}`))
  return parseJson<LugarSugerencia[]>(res)
}

/** Coordenadas de la sugerencia elegida (una llamada al backend solo si vino de Google). */
export async function resolverSugerencia(s: LugarSugerencia): Promise<LugarHit> {
  if (s.lat !== null && s.lng !== null) return { nombre: s.nombre, lat: s.lat, lng: s.lng }
  if (!s.placeId) throw new Error('La sugerencia no tiene ubicación.')

  const sesionUsada = sesion
  sesion = null
  const params = sesionUsada ? `?${new URLSearchParams({ sesion: sesionUsada }).toString()}` : ''
  const res = await meshFetchAuthed(
    apiUrl(`/api/geocoding/lugares/${encodeURIComponent(s.placeId)}${params}`)
  )
  const { lat, lng } = await parseJson<{ lat: number; lng: number }>(res)
  return { nombre: s.nombre, lat, lng }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const url = apiUrl(`/api/geocoding/reverse?${params.toString()}`)
  const res = await meshFetchAuthed(url)
  const data = await parseJson<{ nombre: string }>(res)
  return data.nombre?.trim() || 'Punto en mapa'
}
