import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/httpError'
import { GeocodingService } from './geocoding.service'

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response
}

class AbortErrorFalso extends Error {
  constructor() {
    super('The operation was aborted')
    this.name = 'AbortError'
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('GeocodingService.buscar', () => {
  it('mapea display_name/lat/lon (strings) de Nominatim a {nombre, lat:number, lng:number}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse([
        { display_name: 'Córdoba, Argentina', lat: '-31.4201', lon: '-64.1888' },
        { display_name: 'Córdoba Capital', lat: '-31.42', lon: '-64.19' },
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()
    const resultados = await service.buscar('cordoba')

    expect(resultados).toEqual([
      { nombre: 'Córdoba, Argentina', lat: -31.4201, lng: -64.1888 },
      { nombre: 'Córdoba Capital', lat: -31.42, lng: -64.19 },
    ])

    const urlLlamada = fetchMock.mock.calls[0][0] as string
    expect(urlLlamada).toContain('https://nominatim.openstreetmap.org/search?')
    expect(urlLlamada).toContain('q=cordoba')
    expect(urlLlamada).toContain('format=json')
    expect(urlLlamada).toContain('addressdetails=1')
    expect(urlLlamada).toContain('limit=5')
    expect(urlLlamada).toContain('countrycodes=ar')

    const headersLlamada = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(headersLlamada['User-Agent']).toBe('MeshTesis/1.0 (tesis UTN; contacto académico)')
  })

  it('lanza HttpError GEOCODING_TIMEOUT (504) cuando el fetch aborta por timeout', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new AbortErrorFalso())
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.buscar('algo')).rejects.toMatchObject({
      status: 504,
      code: 'GEOCODING_TIMEOUT',
    } satisfies Partial<HttpError>)
  })

  it('lanza HttpError GEOCODING_UPSTREAM_ERROR (502) cuando el fetch rechaza por red', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.buscar('algo')).rejects.toMatchObject({
      status: 502,
      code: 'GEOCODING_UPSTREAM_ERROR',
    } satisfies Partial<HttpError>)
  })

  it('lanza HttpError GEOCODING_RATE_LIMIT (429) cuando Nominatim responde 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(429))
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.buscar('algo')).rejects.toMatchObject({
      status: 429,
      code: 'GEOCODING_RATE_LIMIT',
    } satisfies Partial<HttpError>)
  })

  it('lanza HttpError GEOCODING_UPSTREAM_ERROR (502) ante otro status no-ok (403)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(403))
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.buscar('algo')).rejects.toMatchObject({
      status: 502,
      code: 'GEOCODING_UPSTREAM_ERROR',
    } satisfies Partial<HttpError>)
  })
})

describe('GeocodingService.reverseGeocode', () => {
  it('mapea display_name a {nombre}, con fallback "Punto en mapa" si viene vacío', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ display_name: 'Plaza San Martín, Córdoba' }))
      .mockResolvedValueOnce(okResponse({ display_name: '' }))
    vi.stubGlobal('fetch', fetchMock)

    // Instancias separadas: el throttle es un detalle por-instancia (en producción
    // hay una sola, ver geocoding.router.ts), así que dos servicios distintos no se
    // pisan entre sí y este test no depende de esperar el intervalo mínimo real.
    await expect(new GeocodingService().reverseGeocode(-31.42, -64.18)).resolves.toEqual({
      nombre: 'Plaza San Martín, Córdoba',
    })
    await expect(new GeocodingService().reverseGeocode(-31.42, -64.18)).resolves.toEqual({
      nombre: 'Punto en mapa',
    })

    const urlLlamada = fetchMock.mock.calls[0][0] as string
    expect(urlLlamada).toContain('https://nominatim.openstreetmap.org/reverse?')
    expect(urlLlamada).toContain('lat=-31.42')
    // Nominatim usa `lon`, nuestro contrato usa `lng`: el nombre del parámetro saliente cambia.
    expect(urlLlamada).toContain('lon=-64.18')
  })

  it('lanza HttpError GEOCODING_TIMEOUT (504) cuando el fetch aborta por timeout', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new AbortErrorFalso())
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.reverseGeocode(0, 0)).rejects.toMatchObject({
      status: 504,
      code: 'GEOCODING_TIMEOUT',
    } satisfies Partial<HttpError>)
  })

  it('lanza HttpError GEOCODING_UPSTREAM_ERROR (502) cuando el fetch rechaza por red', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    await expect(service.reverseGeocode(0, 0)).rejects.toMatchObject({
      status: 502,
      code: 'GEOCODING_UPSTREAM_ERROR',
    } satisfies Partial<HttpError>)
  })
})

describe('GeocodingService — throttle global (1 req/seg hacia Nominatim)', () => {
  it('espacía dos llamadas concurrentes al menos 1000ms, compartido entre buscar y reverseGeocode', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn().mockResolvedValue(okResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const service = new GeocodingService()

    // Dos requests disparadas "al mismo tiempo": una búsqueda y una reversa,
    // el throttle es compartido así que también deben espaciarse entre sí.
    const p1 = service.buscar('a')
    const p2 = service.reverseGeocode(0, 0)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1) // la primera dispara sin demora

    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1) // todavía no pasó 1000ms

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2) // recién a los 1000ms dispara la segunda

    await Promise.all([p1, p2])
  })
})

describe('GeocodingService — Google (con API key)', () => {
  it('buscar usa Places Text Search y arma "nombre, dirección"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        places: [
          {
            displayName: { text: 'Plaza San Martín' },
            formattedAddress: 'X5000 Córdoba, Argentina',
            location: { latitude: -31.4167, longitude: -64.1836 },
          },
          {
            displayName: { text: 'Córdoba' },
            formattedAddress: 'Córdoba, Argentina',
            location: { latitude: -31.42, longitude: -64.19 },
          },
          { displayName: { text: 'Sin ubicación' } },
        ],
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const resultados = await new GeocodingService('KEY_TEST').buscar('plaza san martin')

    expect(resultados).toEqual([
      { nombre: 'Plaza San Martín, X5000 Córdoba, Argentina', lat: -31.4167, lng: -64.1836 },
      { nombre: 'Córdoba, Argentina', lat: -31.42, lng: -64.19 },
    ])
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY_TEST')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ textQuery: 'plaza san martin', regionCode: 'AR', pageSize: 5 })
  })

  it('buscar cae a Nominatim si Google falla', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(403))
      .mockResolvedValueOnce(okResponse([{ display_name: 'Córdoba, Argentina', lat: '-31.4201', lon: '-64.1888' }]))
    vi.stubGlobal('fetch', fetchMock)

    const resultados = await new GeocodingService('KEY_TEST').buscar('cordoba')

    expect(resultados).toEqual([{ nombre: 'Córdoba, Argentina', lat: -31.4201, lng: -64.1888 }])
    expect(fetchMock.mock.calls[1]![0]).toContain('https://nominatim.openstreetmap.org/search?')
  })

  it('autocompletar usa Places Autocomplete con sesión y sesgo por cercanía', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        suggestions: [
          { placePrediction: { placeId: 'ID_VGB', text: { text: 'Villa General Belgrano, Provincia de Córdoba' } } },
          { queryPrediction: { text: { text: 'villa general' } } },
          { placePrediction: { text: { text: 'Sin placeId' } } },
        ],
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const sugerencias = await new GeocodingService('KEY_TEST').autocompletar('villa gen', {
      cerca: { lat: -31.42, lng: -64.18 },
      sesion: 'sesion-1',
    })

    expect(sugerencias).toEqual([
      { nombre: 'Villa General Belgrano, Provincia de Córdoba', placeId: 'ID_VGB', lat: null, lng: null },
    ])
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete')
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY_TEST')
    expect(JSON.parse(init.body as string)).toMatchObject({
      input: 'villa gen',
      includedRegionCodes: ['ar'],
      sessionToken: 'sesion-1',
      locationBias: { circle: { center: { latitude: -31.42, longitude: -64.18 }, radius: 50000 } },
    })
  })

  it('autocompletar cae a la búsqueda clásica (con coordenadas) si Autocomplete falla', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(403)) // Autocomplete
      .mockResolvedValueOnce(errorResponse(403)) // Text Search
      .mockResolvedValueOnce(okResponse([{ display_name: 'Córdoba, Argentina', lat: '-31.4201', lon: '-64.1888' }]))
    vi.stubGlobal('fetch', fetchMock)

    const sugerencias = await new GeocodingService('KEY_TEST').autocompletar('cordoba')

    expect(sugerencias).toEqual([
      { nombre: 'Córdoba, Argentina', placeId: null, lat: -31.4201, lng: -64.1888 },
    ])
  })

  it('autocompletar sin key usa Nominatim directamente', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ display_name: 'Córdoba, Argentina', lat: '-31.4201', lon: '-64.1888' }]))
    vi.stubGlobal('fetch', fetchMock)

    const sugerencias = await new GeocodingService().autocompletar('cordoba')

    expect(sugerencias).toEqual([
      { nombre: 'Córdoba, Argentina', placeId: null, lat: -31.4201, lng: -64.1888 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('detalleLugar pide solo la coordenada a Place Details y manda la sesión', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ location: { latitude: -31.9789, longitude: -64.5583 } }))
    vi.stubGlobal('fetch', fetchMock)

    const lugar = await new GeocodingService('KEY_TEST').detalleLugar('ID_VGB', 'sesion-1')

    expect(lugar).toEqual({ lat: -31.9789, lng: -64.5583 })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places/ID_VGB?sessionToken=sesion-1')
    expect((init.headers as Record<string, string>)['X-Goog-FieldMask']).toBe('location')
  })

  it('detalleLugar responde 404 GEOCODING_LUGAR_NO_ENCONTRADO si Google no conoce el placeId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(404)))

    await expect(new GeocodingService('KEY_TEST').detalleLugar('NO_EXISTE')).rejects.toMatchObject({
      status: 404,
      code: 'GEOCODING_LUGAR_NO_ENCONTRADO',
    } satisfies Partial<HttpError>)
  })

  it('detalleLugar responde 503 GEOCODING_NO_DISPONIBLE sin key, sin llamar a Google', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(new GeocodingService().detalleLugar('ID_VGB')).rejects.toMatchObject({
      status: 503,
      code: 'GEOCODING_NO_DISPONIBLE',
    } satisfies Partial<HttpError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reverseGeocode usa Google Geocoding', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ status: 'OK', results: [{ formatted_address: 'Av. Colón 100, Córdoba' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await new GeocodingService('KEY_TEST').reverseGeocode(-31.41, -64.18)

    expect(r).toEqual({ nombre: 'Av. Colón 100, Córdoba' })
    expect(fetchMock.mock.calls[0]![0]).toContain('https://maps.googleapis.com/maps/api/geocode/json?')
    expect(fetchMock.mock.calls[0]![0]).toContain('latlng=-31.41%2C-64.18')
  })

  it('reverseGeocode con ZERO_RESULTS devuelve "Punto en mapa" sin llamar a Nominatim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ status: 'ZERO_RESULTS', results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await new GeocodingService('KEY_TEST').reverseGeocode(-31.41, -64.18)

    expect(r).toEqual({ nombre: 'Punto en mapa' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reverseGeocode cae a Nominatim si Google responde REQUEST_DENIED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ status: 'REQUEST_DENIED' }))
      .mockResolvedValueOnce(okResponse({ display_name: 'Plaza San Martín, Córdoba' }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await new GeocodingService('KEY_TEST').reverseGeocode(-31.41, -64.18)

    expect(r).toEqual({ nombre: 'Plaza San Martín, Córdoba' })
  })
})
