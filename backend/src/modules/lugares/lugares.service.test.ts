import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/httpError'
import { LugaresService, simplificarTrazado } from './lugares.service'

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}

const RESPUESTA_PLACES = {
  places: [
    {
      id: 'abc',
      displayName: { text: 'YPF Centro' },
      formattedAddress: 'Av. Colón 100, Córdoba',
      location: { latitude: -31.41, longitude: -64.18 },
    },
    { id: 'sin-ubicacion', displayName: { text: 'Sin ubicación' } },
  ],
}

const trazado = [
  { lat: -31.4201, lng: -64.1888 },
  { lat: -31.41, lng: -64.175 },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LugaresService sin API key', () => {
  it('responde 503 LUGARES_NO_DISPONIBLE sin llamar a Google', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      new LugaresService().buscarCercanos({ categoria: 'combustible', lat: -31.4, lng: -64.1, radio_m: 5000 })
    ).rejects.toMatchObject({ status: 503, code: 'LUGARES_NO_DISPONIBLE' } satisfies Partial<HttpError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('LugaresService.buscarEnRuta', () => {
  it('usa Text Search con el trazado encodeado y el tipo de la categoría', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(RESPUESTA_PLACES))
    vi.stubGlobal('fetch', fetchMock)

    const lugares = await new LugaresService('KEY_TEST').buscarEnRuta({ categoria: 'combustible', trazado })

    expect(lugares).toEqual([
      { id: 'abc', nombre: 'YPF Centro', direccion: 'Av. Colón 100, Córdoba', lat: -31.41, lng: -64.18 },
    ])
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY_TEST')
    const body = JSON.parse(init.body as string)
    expect(body.includedType).toBe('gas_station')
    expect(body.searchAlongRouteParameters.polyline.encodedPolyline).toBe('rvw~D~zwfKc~@guA')
  })

  it('sin tipo para la categoría (descanso) busca solo por texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const lugares = await new LugaresService('KEY_TEST').buscarEnRuta({ categoria: 'descanso', trazado })

    expect(lugares).toEqual([])
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.includedType).toBeUndefined()
    expect(body.textQuery).toBe('parador área de descanso')
  })
})

describe('LugaresService.buscarCercanos', () => {
  it('usa Nearby Search ordenado por distancia en un círculo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(RESPUESTA_PLACES))
    vi.stubGlobal('fetch', fetchMock)

    await new LugaresService('KEY_TEST').buscarCercanos({
      categoria: 'sanitario',
      lat: -31.4,
      lng: -64.1,
      radio_m: 2000,
    })

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby')
    const body = JSON.parse(init.body as string)
    expect(body.includedTypes).toEqual(['public_bathroom', 'gas_station'])
    expect(body.rankPreference).toBe('DISTANCE')
    expect(body.locationRestriction.circle).toEqual({ center: { latitude: -31.4, longitude: -64.1 }, radius: 2000 })
  })

  it('traduce 429 de Google a LUGARES_RATE_LIMIT', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(429)))

    await expect(
      new LugaresService('KEY_TEST').buscarCercanos({ categoria: 'combustible', lat: -31.4, lng: -64.1, radio_m: 5000 })
    ).rejects.toMatchObject({ status: 429, code: 'LUGARES_RATE_LIMIT' } satisfies Partial<HttpError>)
  })

  it('traduce otros errores de Google a LUGARES_UPSTREAM_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(403)))

    await expect(
      new LugaresService('KEY_TEST').buscarCercanos({ categoria: 'combustible', lat: -31.4, lng: -64.1, radio_m: 5000 })
    ).rejects.toMatchObject({ status: 502, code: 'LUGARES_UPSTREAM_ERROR' } satisfies Partial<HttpError>)
  })
})

describe('simplificarTrazado', () => {
  it('no toca trazados cortos', () => {
    expect(simplificarTrazado([1, 2, 3], 5)).toEqual([1, 2, 3])
  })

  it('reduce a max puntos conservando primero y último', () => {
    const puntos = Array.from({ length: 1000 }, (_, i) => i)
    const r = simplificarTrazado(puntos, 10)
    expect(r).toHaveLength(10)
    expect(r[0]).toBe(0)
    expect(r[9]).toBe(999)
  })
})
