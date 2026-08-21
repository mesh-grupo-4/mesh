import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const viajeA = '22222222-2222-2222-2222-222222222222'
const viajeB = '33333333-3333-3333-3333-333333333333'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))

const trazaMock = vi.fn()
vi.mock('../../lib/postgis', async (original) => {
  const real = await original<typeof import('../../lib/postgis')>()
  return { ...real, computeTrazaRecorrido: (...args: unknown[]) => trazaMock(...args) }
})

function viajeFinalizado(id: string, finReal: string, creadorId: string) {
  return {
    id,
    creador_id: creadorId,
    nombre: 'Salida',
    es_grupal: true,
    tipo_actividad: 'bici',
    velocidad_esperada: 25,
    distancia_max_separacion: 300,
    fecha_programada: new Date('2026-08-01T12:00:00.000Z'),
    fecha_fin_real: new Date(finReal),
    estado: 'finalizado',
    integrantes: [{ estado: 'confirmado' }],
  }
}

function armarPrisma(viajes: unknown[], metricas: unknown[]) {
  const viajeFindMany = vi.fn().mockResolvedValue(viajes)
  const metricaFindMany = vi.fn().mockResolvedValue(metricas)
  const prisma = {
    viaje: { findMany: viajeFindMany, findUnique: vi.fn() },
    metricaViaje: { findMany: metricaFindMany },
    viajeIntegrante: { findUnique: vi.fn().mockResolvedValue({ estado: 'confirmado' }) },
  } as unknown as PrismaClient
  return { prisma, viajeFindMany, metricaFindMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('US2 — historial de viajes', () => {
  it('adjunta a cada viaje la distancia y el tiempo propios', async () => {
    const m = armarPrisma(
      [
        viajeFinalizado(viajeA, '2026-08-20T18:00:00.000Z', usuarioId),
        viajeFinalizado(viajeB, '2026-08-10T18:00:00.000Z', 'otro-creador'),
      ],
      [{ viaje_id: viajeA, distancia_m: 42300, tiempo_movimiento_seg: 6480 }]
    )

    const lista = await new ViajesService(m.prisma).listarFinalizados(usuarioId)

    expect(lista[0]?.mi_distancia_m).toBe(42300)
    expect(lista[0]?.mi_tiempo_movimiento_seg).toBe(6480)
    // Sin métricas (p. ej. sin GPS) los campos van en null, no en 0.
    expect(lista[1]?.mi_distancia_m).toBeNull()
    expect(lista[1]?.mi_tiempo_movimiento_seg).toBeNull()
  })

  it('pide las métricas de todos los viajes en una sola consulta', async () => {
    const m = armarPrisma(
      [
        viajeFinalizado(viajeA, '2026-08-20T18:00:00.000Z', usuarioId),
        viajeFinalizado(viajeB, '2026-08-10T18:00:00.000Z', usuarioId),
      ],
      []
    )

    await new ViajesService(m.prisma).listarFinalizados(usuarioId)

    expect(m.metricaFindMany).toHaveBeenCalledTimes(1)
    expect(m.metricaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: usuarioId, viaje_id: { in: [viajeA, viajeB] } },
      })
    )
  })

  it('ordena por fecha de fin, del más reciente al más viejo', async () => {
    const m = armarPrisma([], [])
    await new ViajesService(m.prisma).listarFinalizados(usuarioId)

    expect(m.viajeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { fecha_fin_real: 'desc' } })
    )
  })

  it('marca como creador el viaje propio y como participante el ajeno', async () => {
    const m = armarPrisma(
      [
        viajeFinalizado(viajeA, '2026-08-20T18:00:00.000Z', usuarioId),
        viajeFinalizado(viajeB, '2026-08-10T18:00:00.000Z', 'otro-creador'),
      ],
      []
    )

    const lista = await new ViajesService(m.prisma).listarFinalizados(usuarioId)
    expect(lista[0]?.mi_estado).toBe('creador')
    expect(lista[1]?.mi_estado).toBe('confirmado')
  })
})

describe('US2 — recorrido realizado', () => {
  it('devuelve la traza del usuario con su cantidad de puntos', async () => {
    const m = armarPrisma([], [])
    ;(m.prisma.viaje.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      creador_id: usuarioId,
      estado: 'finalizado',
    })
    trazaMock.mockResolvedValue([
      [-31.42, -64.18],
      [-31.43, -64.19],
    ])

    const recorrido = await new ViajesService(m.prisma).obtenerRecorrido(usuarioId, viajeA)

    expect(recorrido.puntos).toHaveLength(2)
    expect(recorrido.cantidad_puntos).toBe(2)
    expect(trazaMock).toHaveBeenCalledWith(m.prisma, viajeA, usuarioId)
  })

  it('un viaje sin GPS devuelve traza vacía en vez de fallar', async () => {
    const m = armarPrisma([], [])
    ;(m.prisma.viaje.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      creador_id: usuarioId,
      estado: 'finalizado',
    })
    trazaMock.mockResolvedValue([])

    const recorrido = await new ViajesService(m.prisma).obtenerRecorrido(usuarioId, viajeA)
    expect(recorrido.puntos).toEqual([])
    expect(recorrido.cantidad_puntos).toBe(0)
  })

  it('un ajeno al viaje no accede al recorrido', async () => {
    const m = armarPrisma([], [])
    ;(m.prisma.viaje.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      creador_id: 'otro-creador',
      estado: 'finalizado',
    })
    ;(m.prisma.viajeIntegrante.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      new ViajesService(m.prisma).obtenerRecorrido(usuarioId, viajeA)
    ).rejects.toMatchObject({ status: 403 })
  })
})
