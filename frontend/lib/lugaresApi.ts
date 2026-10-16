import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/**
 * Sugerencias de lugares por categoría de parada (RN-022) vía Google Places,
 * resueltas por el backend (`/api/lugares/*`): la API key de Google nunca
 * llega al dispositivo.
 */
export type CategoriaLugar = 'combustible' | 'gastronomia' | 'descanso' | 'sanitario'

export type LugarSugerido = {
  id: string
  nombre: string
  direccion: string | null
  lat: number
  lng: number
}

export const CATEGORIAS_LUGAR: { value: CategoriaLugar; label: string; emoji: string }[] = [
  { value: 'combustible', label: 'Combustible', emoji: '⛽' },
  { value: 'gastronomia', label: 'Comer', emoji: '🍽️' },
  { value: 'sanitario', label: 'Baño', emoji: '🚻' },
  { value: 'descanso', label: 'Descanso', emoji: '🌳' },
]

/** Lugares de la categoría a lo largo del trazado ([lat, lng][]) de la ruta planificada. */
export async function buscarLugaresEnRuta(
  categoria: CategoriaLugar,
  trazadoLatLng: [number, number][]
): Promise<LugarSugerido[]> {
  const res = await meshFetchAuthed(apiUrl('/api/lugares/en-ruta'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoria,
      trazado: trazadoLatLng.map(([lat, lng]) => ({ lat, lng })),
    }),
  })
  return parseJson<LugarSugerido[]>(res)
}

/** Lugares de la categoría cerca de una posición, ordenados por distancia. */
export async function buscarLugaresCercanos(
  categoria: CategoriaLugar,
  lat: number,
  lng: number,
  radioM = 5000
): Promise<LugarSugerido[]> {
  const params = new URLSearchParams({
    categoria,
    lat: String(lat),
    lng: String(lng),
    radio_m: String(radioM),
  })
  const res = await meshFetchAuthed(apiUrl(`/api/lugares/cercanos?${params.toString()}`))
  return parseJson<LugarSugerido[]>(res)
}
