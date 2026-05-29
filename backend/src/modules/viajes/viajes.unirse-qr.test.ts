import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { QR_EXPIRED_MESSAGE } from '../../lib/qrInvite'

const usuarioId = '22222222-2222-2222-2222-222222222222'
const viajeId = '44444444-4444-4444-4444-444444444444'
const grupoId = '33333333-3333-3333-3333-333333333333'

function createMockPrisma() {
  const viajeFindUnique = vi.fn()
  const grupoMiembroFindUnique = vi.fn()
  const grupoMiembroCreate = vi.fn()

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    grupoMiembro: {
      findUnique: grupoMiembroFindUnique,
      create: grupoMiembroCreate,
    },
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    viajeFindUnique,
    grupoMiembroFindUnique,
    grupoMiembroCreate,
  }
}

describe('ViajesService.unirsePorQr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agrega al usuario como participante si el viaje está planificado (RN-015/016)', async () => {
    const { prisma, viajeFindUnique, grupoMiembroFindUnique, grupoMiembroCreate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      grupo_id: grupoId,
      es_grupal: true,
      estado: 'planificado',
    })
    grupoMiembroFindUnique.mockResolvedValue(null)
    grupoMiembroCreate.mockResolvedValue({})

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ grupoId, viajeId, yaEraMiembro: false })
    expect(grupoMiembroCreate).toHaveBeenCalledWith({
      data: { grupo_id: grupoId, usuario_id: usuarioId, rol: 'participante' },
    })
  })

  it('es idempotente si el usuario ya es miembro', async () => {
    const { prisma, viajeFindUnique, grupoMiembroFindUnique, grupoMiembroCreate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      grupo_id: grupoId,
      es_grupal: true,
      estado: 'planificado',
    })
    grupoMiembroFindUnique.mockResolvedValue({ rol: 'participante' })

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ grupoId, viajeId, yaEraMiembro: true })
    expect(grupoMiembroCreate).not.toHaveBeenCalled()
  })

  it('lanza 410 con mensaje RN-015 si el viaje ya comenzó', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      grupo_id: grupoId,
      es_grupal: true,
      estado: 'en_curso',
    })

    const service = new ViajesService(prisma)

    await expect(service.unirsePorQr(usuarioId, viajeId)).rejects.toMatchObject({
      status: 410,
      code: 'QR_EXPIRED',
      message: QR_EXPIRED_MESSAGE,
    })
  })

  it('lanza 422 si el viaje no es grupal', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      grupo_id: null,
      es_grupal: false,
      estado: 'planificado',
    })

    const service = new ViajesService(prisma)

    await expect(service.unirsePorQr(usuarioId, viajeId)).rejects.toMatchObject({
      status: 422,
      code: 'QR_NOT_GRUPAL',
    })
  })
})
