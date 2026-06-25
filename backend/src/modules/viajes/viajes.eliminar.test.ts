import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const creadorId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const viajeId = '44444444-4444-4444-4444-444444444444'

function createMockPrisma() {
  const viajeFindUnique = vi.fn()
  const viajeDelete = vi.fn()

  const prisma = {
    viaje: {
      findUnique: viajeFindUnique,
      delete: viajeDelete,
    },
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    viajeFindUnique,
    viajeDelete,
  }
}

describe('ViajesService.eliminarViaje', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina un viaje planificado si el usuario es el creador', async () => {
    const { prisma, viajeFindUnique, viajeDelete } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: creadorId,
      estado: 'planificado',
    })
    viajeDelete.mockResolvedValue({ id: viajeId })

    const service = new ViajesService(prisma)
    const result = await service.eliminarViaje(creadorId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'eliminado' })
    expect(viajeDelete).toHaveBeenCalledWith({ where: { id: viajeId } })
  })

  it('lanza 404 si el viaje no existe', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue(null)

    const service = new ViajesService(prisma)

    await expect(service.eliminarViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 404,
      code: 'VIAJE_NOT_FOUND',
    })
  })

  it('lanza 403 si el usuario no es el creador', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: creadorId,
      estado: 'planificado',
    })

    const service = new ViajesService(prisma)

    await expect(service.eliminarViaje(otroId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_CREATOR',
    })
  })

  it('lanza 409 si el viaje no está planificado', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()
    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      creador_id: creadorId,
      estado: 'en_curso',
    })

    const service = new ViajesService(prisma)

    await expect(service.eliminarViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })
})
