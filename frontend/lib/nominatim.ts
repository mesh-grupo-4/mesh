import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/**
 * Búsqueda de lugares y geocodificación inversa — proxiadas por el backend
 * (`/api/geocoding/...`), que le pega a Nominatim/OpenStreetMap del lado del
 * servidor. Antes se llamaba a Nominatim directo desde el dispositivo, pero
 * React Native en Android (OkHttp) ignora el `User-Agent` seteado a mano vía
 * `fetch()` y Nominatim exige uno identificable — sin él responde 403 siempre,
 * lo que se veía como "sin conexión" al buscar.
 */
export type LugarHit = {
  nombre: string
  lat: number
  lng: number
}

export async function buscarLugares(query: string): Promise<LugarHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url = apiUrl(`/api/geocoding/buscar?${new URLSearchParams({ q }).toString()}`)
  const res = await meshFetchAuthed(url)
  return parseJson<LugarHit[]>(res)
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const url = apiUrl(`/api/geocoding/reverse?${params.toString()}`)
  const res = await meshFetchAuthed(url)
  const data = await parseJson<{ nombre: string }>(res)
  return data.nombre?.trim() || 'Punto en mapa'
}
