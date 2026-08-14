import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'
const terceroId = '44444444-4444-4444-4444-444444444444'
const sinGpsId = '55555555-5555-5555-5555-555555555555'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))

vi.mock('../../lib/postgis', () => ({
  computeLineStringLengthMeters: vi.fn(),
  computeMetricasGpsPorUsuario: vi.fn(),
  computePerfilVelocidad: vi.fn(),
}))

type Opciones = {
  estado?: string
  tipoActividad?: string
  esGrupal?: boolean
}

function armarPrisma(o: Opciones = {}) {
  const { estado = 'finalizado', tipoActividad = 'bici', esGrupal = true } = o

  const viaje = {
    id: viajeId,
    tipo_actividad: tipoActividad,
    estado,
    es_grupal: esGrupal,
    creador_id: creadorId,
  }

  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    viajeIntegrante: {
      findUnique: vi.fn().mockResolvedValue({ estado: 'confirmado' }),
      findMany: vi.fn().mockResolvedValue([
        {
          usuario_id: usuarioId,
          usuario: { id: usuarioId, nombre: 'Ana', apellido: 'Perez' },
        },
        {
          usuario_id: terceroId,
          usuario: { id: terceroId, nombre: 'Luis', apellido: 'Gomez' },
        },
        {
          usuario_id: sinGpsId,
          usuario: { id: sinGpsId, nombre: 'Mia', apellido: 'Sosa' },
        },
      ]),
    },
    resumenViaje: {
      findUnique: vi.fn().mockResolvedValue({
        duracion_segundos: 5400,
        distancia_planeada_m: 42000,
        distancia_real_m: 40850,
        cantidad_paradas: 0,
      }),
    },
    metricaViaje: {
      findMany: vi.fn().mockResolvedValue([
        {
          usuario_id: creadorId,
          distancia_m: 40_000,
          tiempo_movimiento_seg: 5000,
          velocidad_promedio_kmh: 28,
          velocidad_maxima_kmh: 42,
          usuario: { id: creadorId, nombre: 'Cami', apellido: 'Ruiz' },
        },
        {
          usuario_id: usuarioId,
          distancia_m: 38_000,
          tiempo_movimiento_seg: 4800,
          velocidad_promedio_kmh: 30,
          velocidad_maxima_kmh: 40,
          usuario: { id: usuarioId, nombre: 'Ana', apellido: 'Perez' },
        },
        {
          usuario_id: terceroId,
          distancia_m: 38_000,
          tiempo_movimiento_seg: 5200,
          velocidad_promedio_kmh: 26,
          velocidad_maxima_kmh: 35,
          usuario: { id: terceroId, nombre: 'Luis', apellido: 'Gomez' },
        },
      ]),
    },
    usuario: {
      findUnique: vi.fn().mockResolvedValue({ nombre: 'Cami', apellido: 'Ruiz' }),
    },
  } as unknown as PrismaClient

  return { prisma }
}

describe('ViajesService.obtenerMetricasGrupales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('409 si el viaje todavía no finalizó', async () => {
    const { prisma } = armarPrisma({ estado: 'en_curso' })
    const service = new ViajesService(prisma)

    await expect(service.obtenerMetricasGrupales(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'TRIP_NOT_FINISHED',
    })
  })

  it('asigna puestos por distancia, tiempo y velocidad (empate 1, 2, 2)', async () => {
    const { prisma } = armarPrisma()
    const service = new ViajesService(prisma)

    const r = await service.obtenerMetricasGrupales(usuarioId, viajeId)

    expect(r.ranking_habilitado).toBe(true)
    const porId = Object.fromEntries(r.por_integrante.map((p) => [p.usuario_id, p]))

    expect(porId[creadorId].puesto_distancia).toBe(1)
    expect(porId[usuarioId].puesto_distancia).toBe(2)
    expect(porId[terceroId].puesto_distancia).toBe(2)
    expect(porId[sinGpsId].puesto_distancia).toBeNull()

    expect(porId[terceroId].puesto_tiempo).toBe(1)
    expect(porId[creadorId].puesto_tiempo).toBe(2)
    expect(porId[usuarioId].puesto_tiempo).toBe(3)

    expect(porId[usuarioId].puesto_velocidad).toBe(1)
    expect(porId[creadorId].puesto_velocidad).toBe(2)
    expect(porId[terceroId].puesto_velocidad).toBe(3)
    expect(porId[sinGpsId].puesto_velocidad).toBeNull()
  })

  it('incluye al creador y a quien no tiene GPS', async () => {
    const { prisma } = armarPrisma()
    const service = new ViajesService(prisma)

    const r = await service.obtenerMetricasGrupales(usuarioId, viajeId)
    const ids = r.por_integrante.map((p) => p.usuario_id)

    expect(ids).toContain(creadorId)
    expect(ids).toContain(sinGpsId)
    expect(r.por_integrante.find((p) => p.usuario_id === sinGpsId)?.distancia_m).toBeNull()
  })

  it('RN-070: moto sin puestos ni velocidades', async () => {
    const { prisma } = armarPrisma({ tipoActividad: 'moto' })
    const service = new ViajesService(prisma)

    const r = await service.obtenerMetricasGrupales(usuarioId, viajeId)

    expect(r.ranking_habilitado).toBe(false)
    expect(r.por_integrante.every((p) => p.puesto_distancia == null)).toBe(true)
    expect(r.por_integrante.every((p) => p.puesto_velocidad == null)).toBe(true)
    expect(r.por_integrante.every((p) => p.velocidad_promedio_kmh == null)).toBe(true)
    expect(r.por_integrante.every((p) => p.velocidad_maxima_kmh == null)).toBe(true)
  })

  it('viaje individual: ranking deshabilitado y sin puestos', async () => {
    const { prisma } = armarPrisma({ esGrupal: false, tipoActividad: 'running' })
    const service = new ViajesService(prisma)

    const r = await service.obtenerMetricasGrupales(creadorId, viajeId)

    expect(r.ranking_habilitado).toBe(false)
    expect(r.es_grupal).toBe(false)
    expect(r.por_integrante.every((p) => p.puesto_distancia == null)).toBe(true)
  })
})
