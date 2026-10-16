import { HttpError } from '../../lib/httpError'

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const GOOGLE_PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

// Campos mínimos que necesita el buscador (nombre, dirección y coordenadas).
const GOOGLE_PLACES_FIELD_MASK = 'places.displayName,places.formattedAddress,places.location'

const MAX_RESULTADOS = 5

// La política de uso de Nominatim exige identificar la app con un User-Agent
// descriptivo. En React Native/Android el header seteado vía fetch() suele ser
// ignorado por el stack nativo (OkHttp), por eso esta llamada se centraliza acá:
// en Node el header sí se respeta de forma confiable.
const USER_AGENT = 'MeshTesis/1.0 (tesis UTN; contacto académico)'

const TIMEOUT_MS = 8000

// Límite de la política de uso de Nominatim: máximo 1 request/segundo, de forma
// GLOBAL hacia el host (no por IP de cliente). Como acá centralizamos todas las
// búsquedas del backend, el throttle debe ser a nivel de proceso, compartido
// entre buscar() y reverseGeocode().
const MIN_INTERVAL_MS = 1000

export type GeocodingHit = {
  nombre: string
  lat: number
  lng: number
}

export type GeocodingReverseResult = {
  nombre: string
}

type NominatimHit = {
  display_name: string
  lat: string
  lon: string
}

type NominatimReverseResult = {
  display_name?: string
}

type GooglePlacesResponse = {
  places?: Array<{
    displayName?: { text?: string }
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
  }>
}

type GoogleGeocodeResponse = {
  status?: string
  results?: Array<{ formatted_address?: string }>
}

/** "Nombre, dirección" sin repetir el nombre si la dirección ya empieza con él. */
function nombreLugarGoogle(nombre: string | undefined, direccion: string | undefined): string {
  const n = nombre?.trim() ?? ''
  const d = direccion?.trim() ?? ''
  if (!n) return d
  if (!d || d.startsWith(n)) return d || n
  return `${n}, ${d}`
}

export class GeocodingService {
  /**
   * @param googleApiKey Si viene, las búsquedas usan Google Places y la
   * geocodificación inversa Google Geocoding; ante cualquier falla de Google
   * se cae a Nominatim. Sin key se usa solo Nominatim.
   */
  constructor(private readonly googleApiKey?: string) {}

  // Timestamp (ms epoch) del próximo instante en que está permitido disparar
  // una request a Nominatim. Cada llamada reserva su turno de forma síncrona
  // (sin `await` de por medio) para que dos búsquedas concurrentes no lean el
  // mismo valor y se pisen: JS es single-threaded, así que la reserva es atómica
  // mientras no haya un `await` entre la lectura y la escritura.
  private siguienteDisponibleEn = 0

  /** Espera lo necesario para respetar el mínimo de 1000ms entre requests salientes. */
  private async esperarTurno(): Promise<void> {
    const ahora = Date.now()
    const espera = Math.max(0, this.siguienteDisponibleEn - ahora)
    this.siguienteDisponibleEn = Math.max(this.siguienteDisponibleEn, ahora) + MIN_INTERVAL_MS

    if (espera > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, espera))
    }
  }

  private async fetchNominatim(url: string): Promise<unknown> {
    await this.esperarTurno()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
    } catch (e) {
      // `AbortError` = venció nuestro timeout; cualquier otra falla de fetch es de red.
      if (e instanceof Error && e.name === 'AbortError') {
        throw new HttpError(
          504,
          'El servicio de búsqueda de lugares no respondió a tiempo',
          'GEOCODING_TIMEOUT'
        )
      }
      throw new HttpError(
        502,
        'No se pudo contactar el servicio de búsqueda de lugares',
        'GEOCODING_UPSTREAM_ERROR'
      )
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new HttpError(429, 'Demasiadas búsquedas, esperá un momento', 'GEOCODING_RATE_LIMIT')
      }
      throw new HttpError(
        502,
        'El servicio de búsqueda de lugares respondió con un error',
        'GEOCODING_UPSTREAM_ERROR'
      )
    }

    return res.json()
  }

  /** fetch con timeout para Google: cualquier falla se traduce a HttpError para poder caer a Nominatim. */
  private async fetchGoogle(url: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { ...init, signal: controller.signal })
    } catch {
      throw new HttpError(502, 'No se pudo contactar a Google', 'GEOCODING_UPSTREAM_ERROR')
    } finally {
      clearTimeout(timeoutId)
    }
    if (!res.ok) {
      throw new HttpError(502, 'Google respondió con un error', 'GEOCODING_UPSTREAM_ERROR')
    }
    return res.json()
  }

  private async buscarConGoogle(apiKey: string, query: string): Promise<GeocodingHit[]> {
    const data = (await this.fetchGoogle(GOOGLE_PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'es-419',
        regionCode: 'AR',
        pageSize: MAX_RESULTADOS,
      }),
    })) as GooglePlacesResponse

    return (data.places ?? [])
      .filter(
        (p) => typeof p.location?.latitude === 'number' && typeof p.location?.longitude === 'number'
      )
      .slice(0, MAX_RESULTADOS)
      .map((p) => ({
        nombre: nombreLugarGoogle(p.displayName?.text, p.formattedAddress),
        lat: p.location!.latitude!,
        lng: p.location!.longitude!,
      }))
  }

  private async reverseConGoogle(apiKey: string, lat: number, lng: number): Promise<GeocodingReverseResult> {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'es-419', key: apiKey })
    const data = (await this.fetchGoogle(`${GOOGLE_GEOCODE_URL}?${params.toString()}`, {})) as GoogleGeocodeResponse

    // ZERO_RESULTS es una respuesta válida (punto en el medio de la nada);
    // cualquier otro status distinto de OK (key inválida, cuota) cae a Nominatim.
    if (data.status === 'ZERO_RESULTS') return { nombre: 'Punto en mapa' }
    if (data.status !== 'OK') {
      throw new HttpError(502, 'Google respondió con un error', 'GEOCODING_UPSTREAM_ERROR')
    }
    return { nombre: data.results?.[0]?.formatted_address?.trim() || 'Punto en mapa' }
  }

  async buscar(query: string): Promise<GeocodingHit[]> {
    if (this.googleApiKey) {
      try {
        return await this.buscarConGoogle(this.googleApiKey, query)
      } catch {
        // Google caído o sin cuota: seguimos con Nominatim.
      }
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: String(MAX_RESULTADOS),
      countrycodes: 'ar',
    })

    const data = (await this.fetchNominatim(
      `${NOMINATIM_BASE_URL}/search?${params.toString()}`
    )) as NominatimHit[]

    if (!Array.isArray(data)) return []

    return data.map((hit) => ({
      nombre: hit.display_name,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    }))
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodingReverseResult> {
    if (this.googleApiKey) {
      try {
        return await this.reverseConGoogle(this.googleApiKey, lat, lng)
      } catch {
        // Google caído o sin cuota: seguimos con Nominatim.
      }
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
    })

    const data = (await this.fetchNominatim(
      `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`
    )) as NominatimReverseResult

    return { nombre: data.display_name?.trim() || 'Punto en mapa' }
  }
}
