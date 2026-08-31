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
