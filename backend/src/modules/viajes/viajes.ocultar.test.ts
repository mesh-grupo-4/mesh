import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'

vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
}))

vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({
    procesarPing: vi.fn(),
    limpiarViaje: vi.fn(),
    limpiarIntegrante: vi.fn(),
  }),
}))

function armarPrisma(viaje: unknown, integrante: unknown) {
  const integranteUpdate = vi.fn().mockResolvedValue({})
  const viajeDelete = vi.fn().mockResolvedValue({})
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje), delete: viajeDelete },
    viajeIntegrante: {
      findUnique: vi.fn().mockResolvedValue(integrante),
      update: integranteUpdate,
    },
  } as unknown as PrismaClient
  return { prisma, integranteUpdate, viajeDelete }
}

const viajeFinalizado = { id: viajeId, creador_id: creadorId, estado: 'finalizado' }

describe('ViajesService.ocultarDelHistorial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca solo la fila del participante, sin tocar el viaje', async () => {
    const m = armarPrisma(viajeFinalizado, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    const result = await service.ocultarDelHistorial(usuarioId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'ocultado' })
    expect(m.viajeDelete).not.toHaveBeenCalled()
    expect(m.integranteUpdate).toHaveBeenCalledWith({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      data: { oculto_en_historial: true },
    })
  })

  it('quien salió a mitad también puede quitarlo', async () => {
    const m = armarPrisma(viajeFinalizado, { estado: 'salido' })
    const service = new ViajesService(m.prisma)

    await service.ocultarDelHistorial(usuarioId, viajeId)

    expect(m.integranteUpdate).toHaveBeenCalledTimes(1)
  })

  it('el creador no oculta, elimina', async () => {
    const m = armarPrisma(viajeFinalizado, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    await expect(service.ocultarDelHistorial(creadorId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'CREATOR_MUST_DELETE',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('rechaza un viaje que no está finalizado', async () => {
    const m = armarPrisma({ ...viajeFinalizado, estado: 'en_curso' }, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    await expect(service.ocultarDelHistorial(usuarioId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })

  it('rechaza a quien no participó', async () => {
    const m = armarPrisma(viajeFinalizado, { estado: 'rechazado' })
    const service = new ViajesService(m.prisma)

    await expect(service.ocultarDelHistorial(usuarioId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_PARTICIPANT',
    })
  })

  it('404 si el viaje no existe', async () => {
    const m = armarPrisma(null, null)
    const service = new ViajesService(m.prisma)

    await expect(service.ocultarDelHistorial(usuarioId, viajeId)).rejects.toMatchObject({
      status: 404,
    })
  })
})
