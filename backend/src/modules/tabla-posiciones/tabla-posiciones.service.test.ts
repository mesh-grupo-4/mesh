import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { TablaPosicionesService } from './tabla-posiciones.service'

const yoId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const terceroId = '33333333-3333-3333-3333-333333333333'

// Lunes de la semana vigente al momento del test (cualquier fecha sirve, el
// service solo necesita que `ahora` sea posterior a la fecha de los viajes).
const AHORA = new Date('2026-09-10T15:00:00.000Z')

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const viajeFindMany = vi.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
  const metricaGroupBy = vi.fn().mockResolvedValue([
    { usuario_id: otroId, _sum: { distancia_m: 50000, tiempo_movimiento_seg: 7200 } },
    { usuario_id: yoId, _sum: { distancia_m: 30000, tiempo_movimiento_seg: 5400 } },
    { usuario_id: terceroId, _sum: { distancia_m: 10000, tiempo_movimiento_seg: 1800 } },
  ])
  const usuarioFindMany = vi.fn().mockResolvedValue([
    { id: otroId, nombre: 'Ana', apellido: 'Pérez' },
    { id: yoId, nombre: 'Yo', apellido: null },
    { id: terceroId, nombre: 'Beto', apellido: 'Ruiz' },
  ])

  const prisma = {
    viaje: { findMany: viajeFindMany },
    metricaViaje: { groupBy: metricaGroupBy },
    usuario: { findMany: usuarioFindMany },
    ...overrides,
  } as unknown as PrismaClient

  return { prisma, viajeFindMany, metricaGroupBy, usuarioFindMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TablaPosicionesService.obtener', () => {
  it('ordena por distancia descendente y arma el top 3 con nombres', async () => {
    const m = armarPrisma()
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'bici', 'semanal', 'distancia', AHORA)

    expect(tabla.top).toEqual([
      { puesto: 1, usuario_id: otroId, nombre: 'Ana Pérez', distancia_m: 50000, tiempo_movimiento_seg: 7200 },
      { puesto: 2, usuario_id: yoId, nombre: 'Yo', distancia_m: 30000, tiempo_movimiento_seg: 5400 },
      { puesto: 3, usuario_id: terceroId, nombre: 'Beto Ruiz', distancia_m: 10000, tiempo_movimiento_seg: 1800 },
    ])
    expect(tabla.total_participantes).toBe(3)
  })

  it('devuelve mi_posicion aunque no esté en el top 3', async () => {
    const m = armarPrisma({
      metricaViaje: {
        groupBy: vi.fn().mockResolvedValue([
          { usuario_id: otroId, _sum: { distancia_m: 90000, tiempo_movimiento_seg: 1 } },
          { usuario_id: terceroId, _sum: { distancia_m: 80000, tiempo_movimiento_seg: 1 } },
          { usuario_id: 'cuarto', _sum: { distancia_m: 70000, tiempo_movimiento_seg: 1 } },
          { usuario_id: yoId, _sum: { distancia_m: 1000, tiempo_movimiento_seg: 1 } },
        ]),
      },
      usuario: {
        findMany: vi.fn().mockResolvedValue([
          { id: otroId, nombre: 'Ana', apellido: null },
          { id: terceroId, nombre: 'Beto', apellido: null },
          { id: 'cuarto', nombre: 'Caro', apellido: null },
          { id: yoId, nombre: 'Yo', apellido: null },
        ]),
      },
    })
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'bici', 'semanal', 'distancia', AHORA)

    expect(tabla.top).toHaveLength(3)
    expect(tabla.mi_posicion).toEqual({
      puesto: 4,
      usuario_id: yoId,
      nombre: 'Yo',
      distancia_m: 1000,
      tiempo_movimiento_seg: 1,
    })
  })

  it('mi_posicion es null si el usuario no tiene actividad en el período', async () => {
    const m = armarPrisma({
      metricaViaje: {
        groupBy: vi.fn().mockResolvedValue([
          { usuario_id: otroId, _sum: { distancia_m: 10000, tiempo_movimiento_seg: 1 } },
        ]),
      },
      usuario: {
        findMany: vi.fn().mockResolvedValue([{ id: otroId, nombre: 'Ana', apellido: null }]),
      },
    })
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'bici', 'semanal', 'distancia', AHORA)

    expect(tabla.mi_posicion).toBeNull()
  })

  it('tabla vacía si no hay viajes finalizados de esa actividad en el período', async () => {
    const m = armarPrisma({ viaje: { findMany: vi.fn().mockResolvedValue([]) } })
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'trekking', 'semanal', 'distancia', AHORA)

    expect(tabla).toMatchObject({ top: [], mi_posicion: null, total_participantes: 0 })
    expect(m.metricaGroupBy).not.toHaveBeenCalled()
  })

  it('filtra los viajes por tipo de actividad, finalizado, y desde el inicio del período', async () => {
    const m = armarPrisma()
    const service = new TablaPosicionesService(m.prisma)

    await service.obtener(yoId, 'running', 'mensual', 'distancia', AHORA)

    expect(m.viajeFindMany).toHaveBeenCalledWith({
      where: {
        tipo_actividad: 'running',
        estado: 'finalizado',
        fecha_fin_real: { gte: expect.any(Date) },
      },
      select: { id: true },
    })
  })

  it('ordena por tiempo en movimiento cuando se pide ese orden (nunca por velocidad, RN-070)', async () => {
    const m = armarPrisma()
    const service = new TablaPosicionesService(m.prisma)

    await service.obtener(yoId, 'bici', 'semanal', 'tiempo', AHORA)

    expect(m.metricaGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { _sum: { tiempo_movimiento_seg: 'desc' } },
      })
    )
  })

  it('el período mensual arranca el día 1 del mes en curso (ART)', async () => {
    const m = armarPrisma()
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'bici', 'mensual', 'distancia', AHORA)

    expect(tabla.desde).toBe('2026-09-01T03:00:00.000Z') // 00:00 ART = 03:00 UTC
  })

  it('el período anual arranca el 1 de enero del año en curso (ART)', async () => {
    const m = armarPrisma()
    const service = new TablaPosicionesService(m.prisma)

    const tabla = await service.obtener(yoId, 'bici', 'anual', 'distancia', AHORA)

    expect(tabla.desde).toBe('2026-01-01T03:00:00.000Z')
  })
})
