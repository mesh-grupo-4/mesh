import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { MotorEventosService } from './motorEventos.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '33333333-3333-3333-3333-333333333333'
const liderId = '22222222-2222-2222-2222-222222222222'
const otroId = '44444444-4444-4444-4444-444444444444'
const paradaId = '55555555-5555-5555-5555-555555555555'
const alertaId = '66666666-6666-6666-6666-666666666666'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const computeDistanciaPuntoARutaM = vi.fn()
const computeProgresoEnRutaM = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computeDistanciaPuntoARutaM: (...args: unknown[]) => computeDistanciaPuntoARutaM(...args),
  computeProgresoEnRutaM: (...args: unknown[]) => computeProgresoEnRutaM(...args),
}))

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

const linestring = {
  type: 'LineString' as const,
  coordinates: [
    [-64.19, -31.42],
    [-64.18, -31.41],
  ],
}

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const viajeFindUnique = vi.fn().mockResolvedValue({
    id: viajeId,
    estado: 'en_curso',
    es_grupal: true,
    tipo_actividad: 'trekking',
    distancia_max_separacion: 80,
    velocidad_esperada: 5,
    creador_id: liderId,
  })
  const paradaFindFirst = vi.fn().mockResolvedValue(null)
  const paradaCreate = vi.fn().mockResolvedValue({
    id: paradaId,
    viaje_id: viajeId,
    usuario_id: usuarioId,
    lat: -31.42,
    lng: -64.18,
    inicio: new Date('2026-08-21T14:05:00.000Z'),
  })
  const rutaFindUnique = vi.fn().mockResolvedValue({ linestring_geojson: linestring })
  const usuarioFindUnique = vi.fn().mockResolvedValue({ nombre: 'Ana', apellido: 'Pérez' })
  const alertaFindFirst = vi.fn().mockResolvedValue(null)
  const alertaCreate = vi.fn().mockResolvedValue({
    id: alertaId,
    viaje_id: viajeId,
    creada_por_id: null,
    tipo: 'desvio',
    origen: 'sistema',
    mensaje: '[afectado:33333333-3333-3333-3333-333333333333] Ana se desvió ~120 m de la ruta',
    lat: -31.42,
    lng: -64.18,
    estado: 'activa',
    created_at: new Date('2026-08-21T14:00:00.000Z'),
  })
  const integranteFindMany = vi.fn().mockResolvedValue([])
  const ubicacionFindMany = vi.fn().mockResolvedValue([])

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    parada: { findFirst: paradaFindFirst, create: paradaCreate },
    ruta: { findUnique: rutaFindUnique },
    usuario: { findUnique: usuarioFindUnique },
    alerta: { findFirst: alertaFindFirst, create: alertaCreate },
    viajeIntegrante: { findMany: integranteFindMany },
    ubicacionViva: { findMany: ubicacionFindMany },
    ...overrides,
  } as unknown as PrismaClient

  return {
    prisma,
    viajeFindUnique,
    paradaFindFirst,
    paradaCreate,
    rutaFindUnique,
    alertaFindFirst,
    alertaCreate,
    ubicacionFindMany,
  }
}

function ping(ts: string, lat = -31.42, lng = -64.18) {
  return {
    viajeId,
    usuarioId,
    lat,
    lng,
    timestamp: new Date(ts),
  }
}

function eventos(): string[] {
  return emit.mock.calls.map((c) => String(c[0]))
}

beforeEach(() => {
  vi.clearAllMocks()
  computeDistanciaPuntoARutaM.mockResolvedValue(30)
  computeProgresoEnRutaM.mockImplementation(async (_prisma, lat: number) => {
    if (lat === -31.45) return 200
    if (lat === -31.41) return 500
    if (lat === -31.4101) return 480
    return 400
  })
})

describe('MotorEventosService — desvío (RN-034)', () => {
  it('ignora pings si el viaje no está en curso', async () => {
    const m = armarPrisma()
    m.viajeFindUnique.mockResolvedValue({ estado: 'planificado' })
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))

    expect(m.alertaCreate).not.toHaveBeenCalled()
  })

  it('crea alerta de desvío cuando la distancia supera el umbral del viaje', async () => {
    const m = armarPrisma()
    computeDistanciaPuntoARutaM.mockResolvedValue(120)
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))

    expect(m.alertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viaje_id: viajeId,
          origen: 'sistema',
          tipo: 'desvio',
          mensaje: expect.stringContaining('[afectado:33333333-3333-3333-3333-333333333333]'),
        }),
      })
    )
    expect(eventos()).toContain('viaje:alerta')
  })

  it('no duplica alertas activas del mismo integrante', async () => {
    const m = armarPrisma()
    computeDistanciaPuntoARutaM.mockResolvedValue(150)
    m.alertaFindFirst.mockResolvedValue({ id: alertaId })
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))

    expect(m.alertaCreate).not.toHaveBeenCalled()
  })
})

describe('MotorEventosService — detención sospechosa (RN-036)', () => {
  it('abre parada incidente_detectado tras superar el umbral quieto', async () => {
    const m = armarPrisma()
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))
    await service.procesarPing(ping('2026-08-21T14:06:00.000Z'))

    expect(m.paradaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viaje_id: viajeId,
          usuario_id: usuarioId,
          tipo: 'incidente_detectado',
        }),
      })
    )
    expect(eventos()).toContain('viaje:parada_iniciada')
    const payload = emit.mock.calls.find((c) => c[0] === 'viaje:parada_iniciada')?.[1] as {
      estado: string
    }
    expect(payload.estado).toBe('posible_incidente')
    expect(m.alertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'peligro', origen: 'sistema' }),
      })
    )
  })

  it('reinicia el contador si el integrante se movió dentro del radio', async () => {
    const m = armarPrisma()
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z', -31.42, -64.18))
    await service.procesarPing(ping('2026-08-21T14:04:00.000Z', -31.4202, -64.1802))
    await service.procesarPing(ping('2026-08-21T14:08:00.000Z', -31.4202, -64.1802))

    expect(m.paradaCreate).not.toHaveBeenCalled()
  })

  it('no evalúa detención si ya hay parada voluntaria abierta', async () => {
    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId, tipo: 'voluntaria' })
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))
    await service.procesarPing(ping('2026-08-21T14:10:00.000Z'))

    expect(m.paradaCreate).not.toHaveBeenCalled()
  })

  it('no evalúa nada si ya hay incidente_detectado abierto', async () => {
    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId, tipo: 'incidente_detectado' })
    computeDistanciaPuntoARutaM.mockResolvedValue(200)
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))

    expect(m.alertaCreate).not.toHaveBeenCalled()
    expect(m.paradaCreate).not.toHaveBeenCalled()
  })
})

describe('MotorEventosService — atraso (RN-035)', () => {
  it('ignora viajes individuales', async () => {
    const m = armarPrisma()
    m.viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'en_curso',
      es_grupal: false,
      tipo_actividad: 'trekking',
      distancia_max_separacion: 80,
      velocidad_esperada: 5,
      creador_id: liderId,
    })
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z'))

    expect(m.alertaCreate).not.toHaveBeenCalled()
  })

  it('crea alerta de atraso cuando queda atrás del bloque principal', async () => {
    const m = armarPrisma()
    m.ubicacionFindMany.mockResolvedValue([
      { usuario_id: liderId, lat: -31.41, lng: -64.18 },
      { usuario_id: otroId, lat: -31.4101, lng: -64.1801 },
    ])
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z', -31.45, -64.19))

    expect(m.alertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origen: 'sistema',
          tipo: 'atraso',
          mensaje: expect.stringContaining('atrás del grupo'),
        }),
      })
    )
  })

  it('no alerta si hay parada voluntaria abierta', async () => {
    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId, tipo: 'voluntaria' })
    m.ubicacionFindMany.mockResolvedValue([
      { usuario_id: liderId, lat: -31.41, lng: -64.18 },
    ])
    const service = new MotorEventosService(m.prisma)

    await service.procesarPing(ping('2026-08-21T14:00:00.000Z', -31.45, -64.19))

    expect(m.alertaCreate).not.toHaveBeenCalled()
  })
})
