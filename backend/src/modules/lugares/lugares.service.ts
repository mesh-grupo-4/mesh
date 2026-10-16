import polyline from '@mapbox/polyline'

import { HttpError } from '../../lib/httpError'
import type { BuscarCercanosQuery, BuscarEnRutaInput, CategoriaLugar } from './lugares.schemas'

/**
 * Sugerencias de lugares por categoría de parada (RN-022) con Google Places
 * API (New): a lo largo de la ruta planificada (Text Search con
 * `searchAlongRouteParameters`) y cerca de una posición (Nearby Search).
 *
 * A diferencia de geocoding/routing no hay respaldo OpenStreetMap: sin API key
 * el servicio responde 503 y la app avisa que la función no está disponible.
 */
const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'
const SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby'

const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location'
const TIMEOUT_MS = 8000
const MAX_RESULTADOS = 10
/** Puntos máximos del trazado que se mandan a Google: más no mejora la búsqueda y agranda el request. */
const MAX_PUNTOS_TRAZADO = 400

type ConfigCategoria = {
  /** Texto para Text Search a lo largo de la ruta. */
  texto: string
  /** Tipo único (Table A) para filtrar Text Search; sin él se confía en el texto. */
  tipoTexto?: string
  /** Tipos (Table A) para Nearby Search. */
  tiposCercanos: string[]
}

const CATEGORIAS: Record<CategoriaLugar, ConfigCategoria> = {
  combustible: { texto: 'estación de servicio', tipoTexto: 'gas_station', tiposCercanos: ['gas_station'] },
  gastronomia: { texto: 'restaurante', tipoTexto: 'restaurant', tiposCercanos: ['restaurant', 'cafe'] },
  descanso: { texto: 'parador área de descanso', tiposCercanos: ['park', 'campground', 'cafe'] },
  // En ruta los baños públicos son escasos: las estaciones de servicio son el
  // sanitario más frecuente en Argentina.
  sanitario: { texto: 'baño público', tiposCercanos: ['public_bathroom', 'gas_station'] },
}

export type LugarSugerido = {
  id: string
  nombre: string
  direccion: string | null
  lat: number
  lng: number
}

type PlacesResponse = {
  places?: Array<{
    id?: string
    displayName?: { text?: string }
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
  }>
}

/** Submuestreo uniforme conservando siempre el primer y el último punto. */
export function simplificarTrazado<T>(puntos: T[], max: number): T[] {
  if (puntos.length <= max) return puntos
  const paso = (puntos.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => puntos[Math.round(i * paso)]!)
}

export class LugaresService {
  constructor(private readonly googleApiKey?: string) {}

  private requireKey(): string {
    if (!this.googleApiKey) {
      throw new HttpError(
        503,
        'La búsqueda de lugares no está configurada en el servidor',
        'LUGARES_NO_DISPONIBLE'
      )
    }
    return this.googleApiKey
  }

  private async postPlaces(apiKey: string, url: string, body: unknown): Promise<LugarSugerido[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new HttpError(504, 'El servicio de lugares no respondió a tiempo', 'LUGARES_TIMEOUT')
      }
      throw new HttpError(502, 'No se pudo contactar el servicio de lugares', 'LUGARES_UPSTREAM_ERROR')
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new HttpError(429, 'Demasiadas búsquedas de lugares, esperá un momento', 'LUGARES_RATE_LIMIT')
      }
      throw new HttpError(502, 'El servicio de lugares respondió con un error', 'LUGARES_UPSTREAM_ERROR')
    }

    const data = (await res.json()) as PlacesResponse
    return (data.places ?? [])
      .filter(
        (p) => p.id && typeof p.location?.latitude === 'number' && typeof p.location?.longitude === 'number'
      )
      .slice(0, MAX_RESULTADOS)
      .map((p) => ({
        id: p.id!,
        nombre: p.displayName?.text?.trim() || p.formattedAddress?.trim() || 'Lugar sin nombre',
        direccion: p.formattedAddress?.trim() || null,
        lat: p.location!.latitude!,
        lng: p.location!.longitude!,
      }))
  }

  async buscarEnRuta(input: BuscarEnRutaInput): Promise<LugarSugerido[]> {
    const apiKey = this.requireKey()
    const config = CATEGORIAS[input.categoria]
    const trazado = simplificarTrazado(input.trazado, MAX_PUNTOS_TRAZADO)
    const encodedPolyline = polyline.encode(trazado.map((p): [number, number] => [p.lat, p.lng]))

    return this.postPlaces(apiKey, SEARCH_TEXT_URL, {
      textQuery: config.texto,
      ...(config.tipoTexto ? { includedType: config.tipoTexto } : {}),
      languageCode: 'es-419',
      regionCode: 'AR',
      pageSize: MAX_RESULTADOS,
      searchAlongRouteParameters: { polyline: { encodedPolyline } },
    })
  }

  async buscarCercanos(query: BuscarCercanosQuery): Promise<LugarSugerido[]> {
    const apiKey = this.requireKey()
    return this.postPlaces(apiKey, SEARCH_NEARBY_URL, {
      includedTypes: CATEGORIAS[query.categoria].tiposCercanos,
      maxResultCount: MAX_RESULTADOS,
      rankPreference: 'DISTANCE',
      languageCode: 'es-419',
      regionCode: 'AR',
      locationRestriction: {
        circle: { center: { latitude: query.lat, longitude: query.lng }, radius: query.radio_m },
      },
    })
  }
}
