import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { HITOS_RACHA, RachasService } from './rachas.service'

const usuarioId = '11111111-1111-1111-1111-111111111111'

// Lunes de semanas consecutivas (ART). El valor exacto no importa, solo que
// caigan en lunes distintos separados por 7 días.
const LUNES_0 = new Date('2026-09-07T15:00:00.000Z') // lunes 7/9, 12:00 ART
const LUNES_1 = new Date('2026-09-14T15:00:00.000Z') // semana siguiente
const LUNES_2 = new Date('2026-09-21T15:00:00.000Z') // dos semanas después de LUNES_0
const MISMA_SEMANA_QUE_0 = new Date('2026-09-09T15:00:00.000Z') // miércoles de la semana de LUNES_0

vi.mock('../../lib/expoPush', () => ({ sendExpoPush: vi.fn() }))

function armarPrisma(filaInicial: unknown = null) {
  const findUnique = vi.fn().mockImplementation(({ where }: { where: { usuario_id?: string; id?: string } }) => {
    if (where.id) return Promise.resolve({ id: where.id, push_token: null })
    return Promise.resolve(filaInicial)
  })
  const update = vi.fn().mockResolvedValue({})
  const upsert = vi.fn().mockResolvedValue({})
  const findMany = vi.fn().mockResolvedValue([])

  const prisma = {
    rachaActividad: { findUnique, update, upsert, findMany },
    usuario: { findUnique },
  } as unknown as PrismaClient

  return { prisma, findUnique, update, upsert, findMany }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RachasService.registrarActividad', () => {
  it('arranca la racha en 1 cuando no existe fila previa', async () => {
    const m = armarPrisma(null)
    const service = new RachasService(m.prisma)

    await service.registrarActividad(usuarioId, LUNES_0)

    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: usuarioId },
        create: expect.objectContaining({ semanas_consecutivas: 1 }),
      })
    )
  })

  it('arranca en 1 cuando la fila existía pero estaba en 0 (racha ya rota)', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 0,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await service.registrarActividad(usuarioId, LUNES_2)

    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ semanas_consecutivas: 1 }) })
    )
  })

  it('no hace nada si la actividad cae en la misma semana que la última contada', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 2,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await service.registrarActividad(usuarioId, MISMA_SEMANA_QUE_0)

    expect(m.update).not.toHaveBeenCalled()
    expect(m.upsert).not.toHaveBeenCalled()
  })

  it('suma 1 cuando la actividad cae en la semana siguiente', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 2,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await service.registrarActividad(usuarioId, LUNES_1)

    expect(m.update).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId },
      data: { semanas_consecutivas: 3, ultima_actividad: LUNES_1 },
    })
  })

  it('reinicia a 1 cuando hubo un hueco de una semana o más', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 4,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await service.registrarActividad(usuarioId, LUNES_2)

    expect(m.update).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId },
      data: { semanas_consecutivas: 1, inicio_racha: LUNES_2, ultima_actividad: LUNES_2 },
    })
  })

  it('cada hito de HITOS_RACHA dispara exactamente al llegar a ese número', () => {
    expect(HITOS_RACHA).toEqual([3, 5, 10])
  })
})

describe('RachasService.obtenerRachaVigente', () => {
  it('devuelve 0 sin racha previa', async () => {
    const m = armarPrisma(null)
    const service = new RachasService(m.prisma)

    await expect(service.obtenerRachaVigente(usuarioId, LUNES_0)).resolves.toEqual({
      semanas_consecutivas: 0,
      en_riesgo: false,
    })
  })

  it('muestra la racha intacta si ya hubo actividad esta semana', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 3,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await expect(service.obtenerRachaVigente(usuarioId, MISMA_SEMANA_QUE_0)).resolves.toEqual({
      semanas_consecutivas: 3,
      en_riesgo: false,
    })
  })

  it('marca en_riesgo cuando la última actividad fue la semana pasada', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 3,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await expect(service.obtenerRachaVigente(usuarioId, LUNES_1)).resolves.toEqual({
      semanas_consecutivas: 3,
      en_riesgo: true,
    })
  })

  it('muestra 0 (sin mutar) si ya pasó una semana completa sin actividad', async () => {
    const m = armarPrisma({
      usuario_id: usuarioId,
      semanas_consecutivas: 3,
      inicio_racha: LUNES_0,
      ultima_actividad: LUNES_0,
    })
    const service = new RachasService(m.prisma)

    await expect(service.obtenerRachaVigente(usuarioId, LUNES_2)).resolves.toEqual({
      semanas_consecutivas: 0,
      en_riesgo: false,
    })
    expect(m.update).not.toHaveBeenCalled()
  })
})

describe('RachasService.verificarRachasRotas (job diario)', () => {
  it('reinicia a 0 y notifica las rachas con más de una semana sin actividad', async () => {
    const m = armarPrisma()
    m.findMany.mockResolvedValueOnce([
      { usuario_id: usuarioId, semanas_consecutivas: 5, ultima_actividad: LUNES_0 },
      { usuario_id: 'otro', semanas_consecutivas: 2, ultima_actividad: LUNES_1 },
    ])
    const service = new RachasService(m.prisma)

    const rotas = await service.verificarRachasRotas(LUNES_2)

    expect(rotas).toBe(1)
    expect(m.update).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId },
      data: { semanas_consecutivas: 0 },
    })
    expect(m.update).toHaveBeenCalledTimes(1)
  })

  it('no toca nada si ninguna racha tiene más de una semana de hueco', async () => {
    const m = armarPrisma()
    m.findMany.mockResolvedValueOnce([
      { usuario_id: usuarioId, semanas_consecutivas: 5, ultima_actividad: LUNES_1 },
    ])
    const service = new RachasService(m.prisma)

    const rotas = await service.verificarRachasRotas(LUNES_2)

    expect(rotas).toBe(0)
    expect(m.update).not.toHaveBeenCalled()
  })
})
