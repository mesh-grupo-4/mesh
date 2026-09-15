import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ClimaService, descripcionCodigoTiempo } from './clima.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const ajenoId = '99999999-9999-9999-9999-999999999999'

const inicio = new Date(Date.now() + 2 * 86_400_000)
inicio.setUTCMinutes(0, 0, 0)

function horasDesde(d: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(d.getTime() + i * 3_600_000).toISOString().slice(0, 16)
  )
}

/** Un pronóstico horario constante para un punto. */
function hourly(v: {
  prob?: number
  mm?: number
  viento?: number
  rafagas?: number
  codigo?: number
  temp?: number
}) {
  const time = horasDesde(new Date(inicio.getTime() - 3_600_000), 6)
  const n = time.length
  return {
    hourly: {
      time,
      temperature_2m: Array(n).fill(v.temp ?? 18),
      precipitation_probability: Array(n).fill(v.prob ?? 10),
      precipitation: Array(n).fill(v.mm ?? 0),
      wind_speed_10m: Array(n).fill(v.viento ?? 12),
      wind_gusts_10m: Array(n).fill(v.rafagas ?? 20),
      weather_code: Array(n).fill(v.codigo ?? 1),
    },
  }
}

const ruta = {
  origen_lat: -31.42,
  origen_lng: -64.19,
  origen_nombre: 'Córdoba',
  destino_lat: -31.4241,
  destino_lng: -64.4978,
  destino_nombre: 'Carlos Paz',
  linestring_geojson: {
    type: 'LineString',
    coordinates: [
      [-64.19, -31.42],
      [-64.3, -31.42],
      [-64.4, -31.423],
      [-64.4978, -31.4241],
    ],
  },
  tiempo_estimado_seg: 3600,
  paradas_intermedias: [{ lat: -31.42, lng: -64.3, nombre: 'YPF' }],
}

function armar(opts: { estado?: string; conRuta?: boolean; fecha?: Date } = {}) {
  const viajeFindUnique = vi.fn().mockResolvedValue({
    creador_id: liderId,
    estado: opts.estado ?? 'planificado',
    fecha_programada: opts.fecha ?? inicio,
    fecha_inicio_real: null,
    integrantes: [],
    ruta: opts.conRuta === false ? null : ruta,
  })
  const prisma = { viaje: { findUnique: viajeFindUnique } } as unknown as PrismaClient
  const fetchMock = vi.fn()
  return { prisma, fetchMock, viajeFindUnique }
}

function respuesta(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClimaService (SCRUM-27, RN-108)', () => {
  it('muestrea origen, paradas, tramos y destino, y lee la hora estimada de paso', async () => {
    const m = armar()
    m.fetchMock.mockResolvedValue(respuesta([hourly({}), hourly({}), hourly({}), hourly({}), hourly({})]))
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    const out = await service.obtenerParaViaje(liderId, viajeId)

    expect(out.disponible).toBe(true)
    expect(out.puntos.map((p) => p.nombre)).toEqual(['Córdoba', 'YPF', 'Tramo 1', 'Tramo 2', 'Carlos Paz'])
    expect(out.puntos[0]!.hora).toBe(inicio.toISOString())
    expect(out.puntos.at(-1)!.hora).toBe(new Date(inicio.getTime() + 3_600_000).toISOString())
    expect(out.alertas).toEqual([])
    expect(out.resumen).toContain('Sin alertas')

    const url = String(m.fetchMock.mock.calls[0]![0])
    expect(url).toContain('api.open-meteo.com')
    expect(url).toContain('timezone=UTC')
  })

  it('alerta lluvia y viento fuerte según los umbrales', async () => {
    const m = armar()
    m.fetchMock.mockResolvedValue(
      respuesta([
        hourly({ prob: 70 }),
        hourly({ codigo: 63 }),
        hourly({}),
        hourly({ viento: 40 }),
        hourly({ rafagas: 60 }),
      ])
    )
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    const out = await service.obtenerParaViaje(liderId, viajeId)

    expect(out.puntos.filter((p) => p.lluvia).map((p) => p.nombre)).toEqual(['Córdoba', 'YPF'])
    expect(out.puntos.filter((p) => p.viento_fuerte).map((p) => p.nombre)).toEqual(['Tramo 2', 'Carlos Paz'])
    expect(out.alertas.map((a) => a.tipo)).toEqual(['lluvia', 'viento_fuerte'])
    expect(out.alertas[1]!.mensaje).toContain('60 km/h')
  })

  it('sin ruta configurada no consulta al proveedor', async () => {
    const m = armar({ conRuta: false })
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    const out = await service.obtenerParaViaje(liderId, viajeId)

    expect(out).toMatchObject({ disponible: false, motivo: 'SIN_RUTA' })
    expect(m.fetchMock).not.toHaveBeenCalled()
  })

  it('más allá del horizonte de pronóstico responde no disponible', async () => {
    const m = armar({ fecha: new Date(Date.now() + 30 * 86_400_000) })
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    const out = await service.obtenerParaViaje(liderId, viajeId)

    expect(out).toMatchObject({ disponible: false, motivo: 'FUERA_DE_HORIZONTE' })
    expect(m.fetchMock).not.toHaveBeenCalled()
  })

  it('cachea el resultado por viaje', async () => {
    const m = armar()
    m.fetchMock.mockResolvedValue(respuesta([hourly({}), hourly({}), hourly({}), hourly({}), hourly({})]))
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    await service.obtenerParaViaje(liderId, viajeId)
    await service.obtenerParaViaje(liderId, viajeId)

    expect(m.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('RN-030: un ajeno al viaje no ve el pronóstico', async () => {
    const m = armar()
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    await expect(service.obtenerParaViaje(ajenoId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('traduce un error del proveedor a CLIMA_UPSTREAM_ERROR', async () => {
    const m = armar()
    m.fetchMock.mockResolvedValue(respuesta({ error: true }, false))
    const service = new ClimaService(m.prisma, m.fetchMock as unknown as typeof fetch)

    await expect(service.obtenerParaViaje(liderId, viajeId)).rejects.toMatchObject({
      status: 502,
      code: 'CLIMA_UPSTREAM_ERROR',
    })
  })

  it('describe los códigos WMO en español', () => {
    expect(descripcionCodigoTiempo(0)).toBe('Despejado')
    expect(descripcionCodigoTiempo(63)).toBe('Lluvia')
    expect(descripcionCodigoTiempo(95)).toBe('Tormenta')
    expect(descripcionCodigoTiempo(null)).toBe('Sin datos')
  })
})
