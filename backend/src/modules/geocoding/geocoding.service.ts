import { HttpError } from '../../lib/httpError'

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'

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

export class GeocodingService {
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

  async buscar(query: string): Promise<GeocodingHit[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '5',
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
