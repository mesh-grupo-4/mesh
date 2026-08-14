import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const usuarioId = '22222222-2222-2222-2222-222222222222'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))

vi.mock('../../lib/postgis', () => ({
  computeLineStringLengthMeters: vi.fn(),
  computeMetricasGpsPorUsuario: vi.fn(),
}))

function armarPrisma(opts: {
  viajesFinalizados?: number
  actividadFavorita?: string | null
  distanciaSum?: number | null
  tiempoSum?: number | null
} = {}) {
  const {
    viajesFinalizados = 0,
    actividadFavorita = null,
    distanciaSum = null,
    tiempoSum = null,
  } = opts

  const prisma = {
    viaje: {
      count: vi.fn().mockResolvedValue(viajesFinalizados),
      groupBy: vi.fn().mockResolvedValue(
        actividadFavorita
          ? [{ tipo_actividad: actividadFavorita, _count: { tipo_actividad: viajesFinalizados } }]
          : []
      ),
    },
    metricaViaje: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { distancia_m: distanciaSum, tiempo_movimiento_seg: tiempoSum },
      }),
    },
  } as unknown as PrismaClient

  return prisma
}

describe('ViajesService.estadisticasUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve ceros cuando no hay métricas ni viajes', async () => {
    const prisma = armarPrisma()
    const service = new ViajesService(prisma)

    const stats = await service.estadisticasUsuario(usuarioId)

    expect(stats).toEqual({
      viajes_finalizados: 0,
      distancia_total_m: 0,
      tiempo_total_seg: 0,
      actividad_favorita: null,
    })
    expect(prisma.metricaViaje.aggregate).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId },
      _sum: { distancia_m: true, tiempo_movimiento_seg: true },
    })
  })

  it('suma distancias y tiempos de metrica_viaje', async () => {
    const prisma = armarPrisma({
      viajesFinalizados: 3,
      actividadFavorita: 'bici',
      distanciaSum: 12500.5,
      tiempoSum: 7200,
    })
    const service = new ViajesService(prisma)

    const stats = await service.estadisticasUsuario(usuarioId)

    expect(stats).toEqual({
      viajes_finalizados: 3,
      distancia_total_m: 12500.5,
      tiempo_total_seg: 7200,
      actividad_favorita: 'bici',
    })
  })
})
