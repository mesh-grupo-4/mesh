import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'
import { unirsePorCodigoSchema } from './viajes.schemas'
import { QR_EXPIRED_MESSAGE } from '../../lib/qrInvite'

const usuarioId = '22222222-2222-2222-2222-222222222222'
const viajeId = '44444444-4444-4444-4444-444444444444'

function createMockPrisma() {
  const viajeFindUnique = vi.fn()
  const viajeUpdate = vi.fn().mockResolvedValue({})
  const viajeIntegranteFindUnique = vi.fn()
  const viajeIntegranteCreate = vi.fn()
  const viajeIntegranteUpdate = vi.fn()
  const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      viaje: { update: viajeUpdate },
      viajeIntegrante: {
        findUnique: viajeIntegranteFindUnique,
        create: viajeIntegranteCreate,
        update: viajeIntegranteUpdate,
      },
    })
  )

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    viajeIntegrante: {
      findUnique: viajeIntegranteFindUnique,
      create: viajeIntegranteCreate,
      update: viajeIntegranteUpdate,
    },
    $transaction: transaction,
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    viajeFindUnique,
    viajeUpdate,
    viajeIntegranteFindUnique,
    viajeIntegranteCreate,
    viajeIntegranteUpdate,
    transaction,
  }
}

const creadorId = '11111111-1111-1111-1111-111111111111'

describe('ViajesService.unirsePorQr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agrega al usuario al viaje si está planificado (RN-015/016)', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteFindUnique, viajeIntegranteCreate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'planificado',
      es_grupal: true,
      creador_id: creadorId,
    })
    viajeIntegranteFindUnique.mockResolvedValue(null)
    viajeIntegranteCreate.mockResolvedValue({})

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ viajeId, yaEraParticipante: false })
    expect(viajeIntegranteCreate).toHaveBeenCalledWith({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        estado: 'confirmado',
        origen: 'qr',
      },
    })
  })

  it('es idempotente si el usuario ya participa confirmado', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteFindUnique, viajeIntegranteCreate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'planificado',
      es_grupal: true,
      creador_id: creadorId,
    })
    viajeIntegranteFindUnique.mockResolvedValue({ estado: 'confirmado' })

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ viajeId, yaEraParticipante: true })
    expect(viajeIntegranteCreate).not.toHaveBeenCalled()
  })

  it('confirma invitación pendiente al escanear QR', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteFindUnique, viajeIntegranteUpdate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'planificado',
      es_grupal: true,
      creador_id: creadorId,
    })
    viajeIntegranteFindUnique.mockResolvedValue({ estado: 'pendiente' })
    viajeIntegranteUpdate.mockResolvedValue({})

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ viajeId, yaEraParticipante: false })
    expect(viajeIntegranteUpdate).toHaveBeenCalled()
  })

  it('promueve a grupal si alguien se suma por QR a un viaje creado como individual', async () => {
    const { prisma, viajeFindUnique, viajeUpdate, viajeIntegranteFindUnique, viajeIntegranteCreate } =
      createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'planificado',
      es_grupal: false,
      creador_id: creadorId,
    })
    viajeIntegranteFindUnique.mockResolvedValue(null)
    viajeIntegranteCreate.mockResolvedValue({})

    const service = new ViajesService(prisma)
    const result = await service.unirsePorQr(usuarioId, viajeId)

    expect(result).toEqual({ viajeId, yaEraParticipante: false })
    expect(viajeUpdate).toHaveBeenCalledWith({
      where: { id: viajeId },
      data: { es_grupal: true, alerta_incidente_habilitada: true },
    })
  })

  it('no promueve a grupal si el propio creador escanea su QR', async () => {
    const { prisma, viajeFindUnique, viajeUpdate, viajeIntegranteFindUnique } = createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'planificado',
      es_grupal: false,
      creador_id: creadorId,
    })
    viajeIntegranteFindUnique.mockResolvedValue({ estado: 'confirmado' })

    const service = new ViajesService(prisma)
    await service.unirsePorQr(creadorId, viajeId)

    expect(viajeUpdate).not.toHaveBeenCalled()
  })

  it('lanza 410 con mensaje RN-015 si el viaje ya comenzó', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()

    viajeFindUnique.mockResolvedValue({
      id: viajeId,
      estado: 'en_curso',
    })

    const service = new ViajesService(prisma)

    await expect(service.unirsePorQr(usuarioId, viajeId)).rejects.toMatchObject({
      status: 410,
      code: 'QR_EXPIRED',
      message: QR_EXPIRED_MESSAGE,
    })
  })

  it('lanza 410 si el viaje ya finalizó (RN-015)', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteCreate } = createMockPrisma()

    viajeFindUnique.mockResolvedValue({ id: viajeId, estado: 'finalizado' })

    const service = new ViajesService(prisma)

    await expect(service.unirsePorQr(usuarioId, viajeId)).rejects.toMatchObject({
      status: 410,
      code: 'QR_EXPIRED',
    })
    expect(viajeIntegranteCreate).not.toHaveBeenCalled()
  })
})

describe('ViajesService.unirsePorCodigo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agrega al usuario al viaje dueño del código (RN-015/016)', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteFindUnique, viajeIntegranteCreate } =
      createMockPrisma()

    viajeFindUnique
      .mockResolvedValueOnce({ id: viajeId })
      .mockResolvedValueOnce({
        id: viajeId,
        estado: 'planificado',
        es_grupal: true,
        creador_id: creadorId,
      })
    viajeIntegranteFindUnique.mockResolvedValue(null)
    viajeIntegranteCreate.mockResolvedValue({})

    const service = new ViajesService(prisma)
    const result = await service.unirsePorCodigo(usuarioId, 'ABCD2345')

    expect(viajeFindUnique).toHaveBeenNthCalledWith(1, {
      where: { codigo_invitacion: 'ABCD2345' },
      select: { id: true },
    })
    expect(result).toEqual({ viajeId, yaEraParticipante: false })
    expect(viajeIntegranteCreate).toHaveBeenCalledOnce()
  })

  it('lanza 404 si ningún viaje tiene ese código', async () => {
    const { prisma, viajeFindUnique, viajeIntegranteCreate } = createMockPrisma()

    viajeFindUnique.mockResolvedValue(null)

    const service = new ViajesService(prisma)

    await expect(service.unirsePorCodigo(usuarioId, 'ABCD2345')).rejects.toMatchObject({
      status: 404,
      code: 'VIAJE_NOT_FOUND',
    })
    expect(viajeIntegranteCreate).not.toHaveBeenCalled()
  })

  it('lanza 410 si el viaje del código ya no está planificado', async () => {
    const { prisma, viajeFindUnique } = createMockPrisma()

    viajeFindUnique
      .mockResolvedValueOnce({ id: viajeId })
      .mockResolvedValueOnce({ id: viajeId, estado: 'finalizado' })

    const service = new ViajesService(prisma)

    await expect(service.unirsePorCodigo(usuarioId, 'ABCD2345')).rejects.toMatchObject({
      status: 410,
      code: 'QR_EXPIRED',
    })
  })
})

describe('unirsePorCodigoSchema', () => {
  it('normaliza minúsculas, espacios y guion', () => {
    expect(unirsePorCodigoSchema.parse({ codigo: ' abcd-2345 ' })).toEqual({ codigo: 'ABCD2345' })
  })

  it.each(['ABC', 'ABCD23456', 'ABCD234O', 'ABCD2341'])('rechaza %s', (codigo) => {
    expect(unirsePorCodigoSchema.safeParse({ codigo }).success).toBe(false)
  })
})
