import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
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

const inicio = new Date('2026-08-21T14:00:00.000Z')
const ahora = new Date('2026-08-21T14:30:00.000Z')

function armarPrisma(viaje: unknown, integrante: unknown) {
  const integranteUpdate = vi.fn().mockResolvedValue({})
  const prisma = {
    viaje: { findUnique: vi.fn().mockResolvedValue(viaje) },
    viajeIntegrante: {
      findUnique: vi.fn().mockResolvedValue(integrante),
      update: integranteUpdate,
    },
  } as unknown as PrismaClient
  return { prisma, integranteUpdate }
}

const enCurso = { estado: 'en_curso', creador_id: creadorId, fecha_inicio_real: inicio }

describe('ViajesService.checkIn (RN-029b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(ahora)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marca el check-in, avisa a la sala y devuelve la hora', async () => {
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    const out = await service.checkIn(usuarioId, viajeId)

    expect(out).toEqual({ viaje_id: viajeId, check_in_at: ahora })
    expect(m.integranteUpdate).toHaveBeenCalledWith({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      data: { check_in_at: ahora },
    })
    expect(emit).toHaveBeenCalledWith('viaje:participante_sumado', {
      viajeId,
      usuarioId,
      checkInAt: ahora.toISOString(),
    })
  })

  it('respeta la hora en que tocó "Me sumo" si llega tarde desde la cola offline', async () => {
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)
    const tocado = new Date('2026-08-21T14:10:00.000Z')

    const out = await service.checkIn(usuarioId, viajeId, { check_in_at: tocado })

    expect(out.check_in_at).toEqual(tocado)
  })

  it('acota la hora entre el inicio real del viaje y ahora', async () => {
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    const antes = await service.checkIn(usuarioId, viajeId, {
      check_in_at: new Date('2026-08-21T10:00:00.000Z'),
    })
    expect(antes.check_in_at).toEqual(inicio)

    const m2 = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: null })
    const futuro = await new ViajesService(m2.prisma).checkIn(usuarioId, viajeId, {
      check_in_at: new Date('2026-08-22T10:00:00.000Z'),
    })
    expect(futuro.check_in_at).toEqual(ahora)
  })

  it('es idempotente: si ya se sumó devuelve el check-in original sin reescribirlo', async () => {
    const previo = new Date('2026-08-21T14:05:00.000Z')
    const m = armarPrisma(enCurso, { estado: 'confirmado', check_in_at: previo })
    const service = new ViajesService(m.prisma)

    const out = await service.checkIn(usuarioId, viajeId)

    expect(out.check_in_at).toEqual(previo)
    expect(m.integranteUpdate).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('409 si el viaje no está en curso', async () => {
    const m = armarPrisma({ ...enCurso, estado: 'planificado' }, { estado: 'confirmado', check_in_at: null })
    const service = new ViajesService(m.prisma)

    await expect(service.checkIn(usuarioId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
  })

  it.each(['pendiente', 'rechazado', 'ausente', 'salido'])('403 para un integrante %s', async (estado) => {
    const m = armarPrisma(enCurso, { estado, check_in_at: null })
    const service = new ViajesService(m.prisma)

    await expect(service.checkIn(usuarioId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_PARTICIPANT',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('el líder de un viaje legacy sin fila ya está sumado desde el inicio', async () => {
    const m = armarPrisma(enCurso, null)
    const service = new ViajesService(m.prisma)

    const out = await service.checkIn(creadorId, viajeId)

    expect(out.check_in_at).toEqual(inicio)
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })
})
