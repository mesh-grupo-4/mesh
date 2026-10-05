import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const limpiarIntegrante = vi.fn()
vi.mock('../motor-eventos/motorEventos.service', () => ({
  obtenerMotorEventos: () => ({
    procesarPing: vi.fn(),
    limpiarViaje: vi.fn(),
    limpiarIntegrante,
  }),
}))

type MockPrisma = {
  viajeFindUnique: ReturnType<typeof vi.fn>
  integranteFindUnique: ReturnType<typeof vi.fn>
  integranteUpdate: ReturnType<typeof vi.fn>
  integranteDelete: ReturnType<typeof vi.fn>
  paradaUpdateMany: ReturnType<typeof vi.fn>
  alertaFindMany: ReturnType<typeof vi.fn>
  alertaUpdateMany: ReturnType<typeof vi.fn>
  ubicacionDeleteMany: ReturnType<typeof vi.fn>
  prisma: PrismaClient
}

function armarPrisma(viaje: unknown, integrante: unknown): MockPrisma {
  const viajeFindUnique = vi.fn().mockResolvedValue(viaje)
  const integranteFindUnique = vi.fn().mockResolvedValue(integrante)
  const integranteUpdate = vi.fn().mockResolvedValue({})
  const integranteDelete = vi.fn().mockResolvedValue({})
  const paradaUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
  const alertaFindMany = vi.fn().mockResolvedValue([])
  const alertaUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
  const ubicacionDeleteMany = vi.fn().mockResolvedValue({ count: 0 })

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    viajeIntegrante: {
      findUnique: integranteFindUnique,
      update: integranteUpdate,
      delete: integranteDelete,
    },
    parada: { updateMany: paradaUpdateMany },
    alerta: { findMany: alertaFindMany, updateMany: alertaUpdateMany },
    ubicacionViva: { deleteMany: ubicacionDeleteMany },
  } as unknown as PrismaClient

  return {
    viajeFindUnique,
    integranteFindUnique,
    integranteUpdate,
    integranteDelete,
    paradaUpdateMany,
    alertaFindMany,
    alertaUpdateMany,
    ubicacionDeleteMany,
    prisma,
  }
}

const viajeGrupalEnCurso = {
  id: viajeId,
  creador_id: creadorId,
  estado: 'en_curso',
  es_grupal: true,
}

describe('ViajesService.salirViaje', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca al integrante como salido en vez de borrarlo', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(usuarioId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'salido' })
    expect(m.integranteDelete).not.toHaveBeenCalled()
    expect(m.integranteUpdate).toHaveBeenCalledTimes(1)

    const args = m.integranteUpdate.mock.calls[0]![0] as {
      data: { estado: string; fecha_salida: Date }
    }
    expect(args.data.estado).toBe('salido')
    expect(args.data.fecha_salida).toBeInstanceOf(Date)
  })

  it('al salir de un viaje en curso cierra su parada, resuelve sus alertas y lo saca del mapa', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { estado: 'confirmado' })
    m.alertaFindMany.mockResolvedValue([{ id: 'a1' }])
    const service = new ViajesService(m.prisma)

    await service.salirViaje(usuarioId, viajeId)

    expect(m.paradaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { viaje_id: viajeId, fin: null, usuario_id: usuarioId },
      })
    )
    expect(m.alertaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'resuelta' }) })
    )
    expect(m.ubicacionDeleteMany).toHaveBeenCalledWith({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
    })
    expect(limpiarIntegrante).toHaveBeenCalledWith(viajeId, usuarioId)
    const eventos = emit.mock.calls.map((c) => String(c[0]))
    expect(eventos).toContain('viaje:alerta_actualizada')
    expect(eventos).toContain('viaje:participante_salio')
  })

  it('si el viaje todavía está planificado no hay nada en vivo que cerrar', async () => {
    const m = armarPrisma({ ...viajeGrupalEnCurso, estado: 'planificado' }, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    await service.salirViaje(usuarioId, viajeId)

    expect(m.ubicacionDeleteMany).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('rechaza abandonar un viaje individual', async () => {
    const m = armarPrisma({ ...viajeGrupalEnCurso, es_grupal: false }, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INDIVIDUAL_TRIP',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('el líder no puede salir, debe finalizar', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { estado: 'confirmado' })
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'LEADER_CANNOT_LEAVE',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('rechaza a quien no es participante confirmado', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { estado: 'pendiente' })
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_PARTICIPANT',
    })
  })

  it('404 si el viaje no existe', async () => {
    const m = armarPrisma(null, null)
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toBeInstanceOf(HttpError)
  })
})
