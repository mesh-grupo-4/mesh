import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { createViajeSchema } from './viajes.schemas'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const viajeId = '44444444-4444-4444-4444-444444444444'
const anteriorId = '33333333-3333-3333-3333-333333333333'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({ procesarPing: vi.fn(), limpiarViaje: vi.fn(), limpiarIntegrante: vi.fn() }),
}))

const computeSplitsPorKm = vi.fn()
vi.mock('../../lib/postgis', () => ({
  computePerfilVelocidad: vi.fn().mockResolvedValue([]),
  computeSplitsPorKm: (...a: unknown[]) => computeSplitsPorKm(...a),
  computeMetricasGpsPorUsuario: vi.fn(),
  computeLineStringLengthMeters: vi.fn(),
  computeTrazaRecorrido: vi.fn(),
}))

function armar(opts: { modo?: string; tipo?: string } = {}) {
  const viaje = {
    id: viajeId,
    creador_id: usuarioId,
    nombre: 'Tirada larga',
    tipo_actividad: opts.tipo ?? 'running',
    modo: opts.modo ?? 'entrenamiento',
    es_grupal: false,
    estado: 'finalizado',
    fecha_inicio_real: new Date('2026-09-10T10:00:00.000Z'),
    fecha_fin_real: new Date('2026-09-10T11:00:00.000Z'),
  }
  const metricaFindMany = vi.fn().mockResolvedValue([
    {
      viaje_id: anteriorId,
      distancia_m: 8000,
      tiempo_movimiento_seg: 2880, // 6:00 min/km
      velocidad_promedio_kmh: 10,
      viaje: { nombre: 'Rodaje', fecha_fin_real: new Date('2026-09-03T11:00:00.000Z') },
    },
    {
      viaje_id: viajeId,
      distancia_m: 10000,
      tiempo_movimiento_seg: 3300, // 5:30 min/km
      velocidad_promedio_kmh: 10.9,
      viaje: { nombre: 'Tirada larga', fecha_fin_real: viaje.fecha_fin_real },
    },
  ])
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    resumenViaje: {
      findUnique: vi.fn().mockResolvedValue({ duracion_segundos: 3600, distancia_planeada_m: null, cantidad_paradas: 0 }),
    },
    metricaViaje: {
      findUnique: vi.fn().mockResolvedValue({
        distancia_m: 10000,
        tiempo_movimiento_seg: 3300,
        velocidad_promedio_kmh: 10.9,
        velocidad_maxima_kmh: 14,
      }),
      findMany: metricaFindMany,
    },
  } as unknown as PrismaClient
  return { prisma, metricaFindMany }
}

beforeEach(() => {
  vi.clearAllMocks()
  computeSplitsPorKm.mockResolvedValue([
    { km: 1, metros: 1000, segundos: 330 },
    { km: 2, metros: 600, segundos: 200 },
  ])
})

describe('RN-065 — modo entrenamiento', () => {
  it('crear: modo por defecto recreativo; competitivo pasa el schema', () => {
    const base = { nombre: 'x', esGrupal: false, tipoActividad: 'running', fechaProgramada: new Date(Date.now() + 86_400_000).toISOString() }
    const r = createViajeSchema.safeParse(base)
    expect(r.success && r.data.modo).toBe('recreativo')
    expect(createViajeSchema.safeParse({ ...base, modo: 'entrenamiento' }).success).toBe(true)
    // RN-071: competitivo se acepta en el schema; el servicio exige grupal y no moto.
    expect(createViajeSchema.safeParse({ ...base, modo: 'competitivo' }).success).toBe(true)
  })

  it('mis-metricas: splits por km con ritmo y evolución respecto de sesiones anteriores', async () => {
    const m = armar()
    const out = await new ViajesService(m.prisma).obtenerMisMetricas(usuarioId, viajeId)

    expect(out.viaje.modo).toBe('entrenamiento')
    expect(out.splits_km).toHaveLength(2)
    expect(out.splits_km[0]!.pace_min_km).toBeCloseTo(5.5, 3)
    expect(out.splits_km[1]!.metros).toBe(600) // último km parcial

    expect(m.metricaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usuario_id: usuarioId,
          viaje: { estado: 'finalizado', modo: 'entrenamiento', tipo_actividad: 'running' },
        }),
      })
    )
    const e = out.entrenamiento!
    expect(e.numero_sesion).toBe(2)
    expect(e.total_sesiones).toBe(2)
    expect(e.es_mejor_pace).toBe(true)
    expect(e.es_mejor_distancia).toBe(true)
    expect(e.delta_distancia_m).toBe(2000)
    expect(e.delta_pace_min_km).toBeCloseTo(-0.5, 3)
    expect(e.evolucion.map((s) => s.viaje_id)).toEqual([anteriorId, viajeId])
  })

  it('en modo recreativo no hay bloque de entrenamiento pero sí splits', async () => {
    const m = armar({ modo: 'recreativo' })
    const out = await new ViajesService(m.prisma).obtenerMisMetricas(usuarioId, viajeId)

    expect(out.entrenamiento).toBeNull()
    expect(m.metricaFindMany).not.toHaveBeenCalled()
    expect(out.splits_km).toHaveLength(2)
  })

  it('RN-070: en moto no hay splits ni ritmos, tampoco entrenando', async () => {
    const m = armar({ tipo: 'moto' })
    const out = await new ViajesService(m.prisma).obtenerMisMetricas(usuarioId, viajeId)

    expect(computeSplitsPorKm).not.toHaveBeenCalled()
    expect(out.splits_km).toEqual([])
    expect(out.metricas.velocidad_promedio_kmh).toBeNull()
    expect(out.entrenamiento!.mejor_pace_min_km).toBeNull()
    expect(out.entrenamiento!.evolucion.every((s) => s.velocidad_promedio_kmh == null)).toBe(true)
  })
})
