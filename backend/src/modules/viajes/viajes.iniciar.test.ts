import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const otroViajeId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({
    procesarPing: vi.fn(),
    limpiarViaje: vi.fn(),
    limpiarIntegrante: vi.fn(),
  }),
}))

vi.mock('../../lib/expoPush', () => ({ sendExpoPush: vi.fn() }))

function armarPrisma(otroEnCurso: { id: string; nombre: string | null } | null = null) {
  const viaje = { id: viajeId, creador_id: creadorId, estado: 'planificado', nombre: 'Salida' }
  const executeRaw = vi.fn().mockResolvedValue(1)
  const findFirst = vi.fn().mockResolvedValue(otroEnCurso)
  const update = vi.fn().mockResolvedValue({
    ...viaje,
    estado: 'en_curso',
    fecha_inicio_real: new Date('2026-11-09T14:00:00.000Z'),
  })
  const upsert = vi.fn().mockResolvedValue({})
  const tx = {
    $executeRaw: executeRaw,
    viaje: { findFirst, update },
    viajeIntegrante: { upsert },
  }
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    // RN-029e: al iniciar se avisa por push a los confirmados que no están.
    viajeIntegrante: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient
  return { prisma, executeRaw, findFirst, update, upsert }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ViajesService.iniciar — RN-030c: un solo viaje en curso por persona', () => {
  it('inicia el viaje si no hay otro en curso', async () => {
    const m = armarPrisma()
    const service = new ViajesService(m.prisma)

    const out = await service.iniciar(creadorId, viajeId)

    expect(out.estado).toBe('en_curso')
    expect(m.update).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('viaje:iniciado', expect.objectContaining({ viajeId }))
  })

  it('rechaza con 409 e informa cuál es el viaje en curso', async () => {
    const m = armarPrisma({ id: otroViajeId, nombre: 'Sierras' })
    const service = new ViajesService(m.prisma)

    await expect(service.iniciar(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'OTRO_VIAJE_EN_CURSO',
      message: expect.stringContaining('Sierras'),
      datos: { viaje_en_curso_id: otroViajeId },
    })
    expect(m.update).not.toHaveBeenCalled()
    expect(m.upsert).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('toma el lock antes de buscar el otro viaje', async () => {
    const m = armarPrisma()
    const service = new ViajesService(m.prisma)

    await service.iniciar(creadorId, viajeId)

    expect(m.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      m.findFirst.mock.invocationCallOrder[0]
    )
  })

  it('cuenta los viajes que lidera o a los que se sumó, sin el confirmado sin check-in', async () => {
    const m = armarPrisma()
    const service = new ViajesService(m.prisma)

    await service.iniciar(creadorId, viajeId)

    expect(m.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: viajeId },
          estado: 'en_curso',
          OR: [
            { creador_id: creadorId },
            {
              integrantes: {
                some: {
                  usuario_id: creadorId,
                  estado: 'confirmado',
                  check_in_at: { not: null },
                },
              },
            },
          ],
        },
      })
    )
  })
})
