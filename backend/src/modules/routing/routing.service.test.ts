import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/httpError'
import { RoutingService } from './routing.service'
import type { CalcularRutaInput } from './routing.schemas'

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

const input: CalcularRutaInput = {
  perfil: 'walking',
  puntos: [
    { lat: -31.4201, lng: -64.1888 },
    { lat: -31.41, lng: -64.175 },
  ],
}

// Polyline (precisión 5) de dos puntos: (-31.4201,-64.1888) → (-31.41,-64.175).
const OSRM_GEOMETRY = 'rvw~D~zwfKc~@guA'
// Polyline (precisión 6) de los mismos dos puntos, para el leg único de Valhalla.
const VALHALLA_SHAPE = 'fkv|z@~vwlyBgvRo}Y'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RoutingService.calcularRuta — OSRM (proveedor principal)', () => {
  it('decodifica la geometry y mapea distance/duration a distancia_m/duracion_seg', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({ routes: [{ distance: 2728, duration: 1750, geometry: OSRM_GEOMETRY }] })
    )
    vi.stubGlobal('fetch', fetchMock)

    const ruta = await new RoutingService().calcularRuta(input)

    expect(ruta.distancia_m).toBe(2728)
    expect(ruta.duracion_seg).toBe(1750)
    expect(ruta.linestring.type).toBe('LineString')
    expect(ruta.linestring.coordinates.length).toBeGreaterThanOrEqual(2)

    const urlLlamada = fetchMock.mock.calls[0]![0] as string
    expect(urlLlamada).toContain('https://router.project-osrm.org/route/v1/walking/')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('no llama a Valhalla si OSRM responde bien', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({ routes: [{ distance: 1, duration: 1, geometry: OSRM_GEOMETRY }] })
    )
    vi.stubGlobal('fetch', fetchMock)

    await new RoutingService().calcularRuta(input)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('RoutingService.calcularRuta — respaldo con Valhalla', () => {
  it('si OSRM falla (timeout), prueba con Valhalla antes de rendirse', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new AbortErrorFalso())
      .mockResolvedValueOnce(
        okResponse({
          trip: {
            status: 0,
            summary: { time: 1750, length: 2.728 },
            legs: [{ shape: VALHALLA_SHAPE }],
          },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const ruta = await new RoutingService().calcularRuta(input)

    expect(ruta.duracion_seg).toBe(1750)
    expect(ruta.distancia_m).toBeCloseTo(2728)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const segundaUrl = fetchMock.mock.calls[1]![0] as string
    expect(segundaUrl).toBe('https://valhalla1.openstreetmap.de/route')
  })

  it('si OSRM no encuentra ruta (no_route), igual prueba con Valhalla', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ code: 'NoRoute' }))
      .mockResolvedValueOnce(
        okResponse({
          trip: {
            status: 0,
            summary: { time: 1750, length: 2.728 },
            legs: [{ shape: VALHALLA_SHAPE }],
          },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const ruta = await new RoutingService().calcularRuta(input)

    expect(ruta.duracion_seg).toBe(1750)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('si los dos proveedores fallan, propaga el último error (HttpError de Valhalla)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new RoutingService().calcularRuta(input)).rejects.toMatchObject({
      status: 502,
      code: 'ROUTING_UPSTREAM_ERROR',
    } satisfies Partial<HttpError>)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('une los legs de Valhalla sin duplicar el punto de unión', async () => {
    // OSRM falla primero para forzar el respaldo; Valhalla responde con 2 legs.
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('osrm caído'))
      .mockResolvedValueOnce(
        okResponse({
          trip: {
            status: 0,
            summary: { time: 100, length: 1 },
            legs: [{ shape: VALHALLA_SHAPE }, { shape: VALHALLA_SHAPE }],
          },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const ruta = await new RoutingService().calcularRuta({
      perfil: 'walking',
      puntos: [
        { lat: -31.4201, lng: -64.1888 },
        { lat: -31.415, lng: -64.182 },
        { lat: -31.41, lng: -64.175 },
      ],
    })

    // Cada leg decodificado tiene 2 puntos; unidos sin duplicar el de unión: 3 puntos totales.
    expect(ruta.linestring.coordinates.length).toBe(3)
  })
})

describe('RoutingService.calcularRuta — errores de upstream', () => {
  it('lanza ROUTING_RATE_LIMIT (429) cuando el proveedor responde 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(errorResponse(429))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new RoutingService().calcularRuta(input)).rejects.toMatchObject({
      status: 429,
      code: 'ROUTING_RATE_LIMIT',
    } satisfies Partial<HttpError>)
  })

  it('lanza ROUTING_NO_ROUTE (422) si ningún proveedor encuentra ruta', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ code: 'NoRoute' }))
      .mockResolvedValueOnce(okResponse({ trip: { status: 207, status_message: 'No path' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new RoutingService().calcularRuta(input)).rejects.toMatchObject({
      status: 422,
      code: 'ROUTING_NO_ROUTE',
    } satisfies Partial<HttpError>)
  })
})
