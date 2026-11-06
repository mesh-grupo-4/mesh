import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const creadorId = '33333333-3333-3333-3333-333333333333'
const sucesorId = '44444444-4444-4444-4444-444444444444'

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

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({ sendExpoPush: (...a: unknown[]) => sendExpoPush(...a) }))

const inicio = new Date('2026-08-21T14:00:00.000Z')

function armarPrisma(viaje: unknown, sucesor: unknown) {
  const viajeUpdate = vi.fn().mockResolvedValue({})
  const integranteUpsert = vi.fn().mockResolvedValue({})
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje), update: viajeUpdate },
    viajeIntegrante: {
      findUnique: vi.fn().mockResolvedValue(sucesor),
      upsert: integranteUpsert,
    },
    usuario: { findUnique: vi.fn().mockResolvedValue({ push_token: 'ExponentPushToken[x]' }) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  } as unknown as PrismaClient
  return { prisma, viajeUpdate, integranteUpsert }
}

const base = {
  id: viajeId,
  creador_id: creadorId,
  es_grupal: true,
  nombre: 'Sierras',
  fecha_inicio_real: null,
}
const planificado = { ...base, estado: 'planificado' }
const enCurso = { ...base, estado: 'en_curso', fecha_inicio_real: inicio }

describe('ViajesService.cederLiderazgo (RN-029d)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('planificado: pasa el viaje a un confirmado y el líder anterior sigue como participante', async () => {
    const m = armarPrisma(planificado, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    const out = await service.cederLiderazgo(creadorId, viajeId, sucesorId)

    expect(out).toEqual({ viaje_id: viajeId, lider_id: sucesorId })
    expect(m.viajeUpdate).toHaveBeenCalledWith({
      where: { id: viajeId },
      data: { creador_id: sucesorId },
    })
    expect(m.integranteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: creadorId } },
        create: expect.objectContaining({ estado: 'confirmado', check_in_at: null }),
        update: {},
      })
    )
    expect(emit).toHaveBeenCalledWith('viaje:lider_cambiado', {
      viajeId,
      liderAnteriorId: creadorId,
      liderNuevoId: sucesorId,
    })
  })

  it('en curso: el líder saliente conserva el check-in (sigue en el viaje)', async () => {
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: inicio })
    const service = new ViajesService(m.prisma)

    await service.cederLiderazgo(creadorId, viajeId, sucesorId)

    expect(m.integranteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ check_in_at: inicio }) })
    )
  })

  it('avisa por push al nuevo líder', async () => {
    const m = armarPrisma(planificado, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    await service.cederLiderazgo(creadorId, viajeId, sucesorId)
    await vi.waitFor(() => expect(sendExpoPush).toHaveBeenCalled())

    expect(sendExpoPush).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[x]', title: 'Ahora sos el líder' }),
    ])
  })

  it('solo el líder actual puede ceder (RN-030)', async () => {
    const m = armarPrisma(planificado, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    await expect(service.cederLiderazgo(sucesorId, viajeId, creadorId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_CREATOR',
    })
  })

  it('no se puede ceder a sí mismo', async () => {
    const m = armarPrisma(planificado, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    await expect(service.cederLiderazgo(creadorId, viajeId, creadorId)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_LEADER',
    })
  })

  it.each(['pendiente', 'rechazado', 'ausente', 'salido'])(
    'no se puede ceder a un integrante %s',
    async (estado) => {
      const m = armarPrisma(planificado, { estado, check_in_at: null })
      const service = new ViajesService(m.prisma)

      await expect(service.cederLiderazgo(creadorId, viajeId, sucesorId)).rejects.toMatchObject({
        status: 404,
        code: 'MEMBER_NOT_FOUND',
      })
      expect(m.viajeUpdate).not.toHaveBeenCalled()
    }
  )

  it('en curso no se puede ceder a alguien que no se sumó', async () => {
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    await expect(service.cederLiderazgo(creadorId, viajeId, sucesorId)).rejects.toMatchObject({
      status: 409,
      code: 'NOT_CHECKED_IN',
    })
  })

  it('409 en un viaje finalizado y en uno individual', async () => {
    const finalizado = armarPrisma({ ...base, estado: 'finalizado' }, null)
    await expect(
      new ViajesService(finalizado.prisma).cederLiderazgo(creadorId, viajeId, sucesorId)
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })

    const individual = armarPrisma({ ...planificado, es_grupal: false }, null)
    await expect(
      new ViajesService(individual.prisma).cederLiderazgo(creadorId, viajeId, sucesorId)
    ).rejects.toMatchObject({ status: 409, code: 'INDIVIDUAL_TRIP' })
  })
})
