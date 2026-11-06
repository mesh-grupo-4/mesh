import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { ViajesService } from './viajes.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const usuarioId = '22222222-2222-2222-2222-222222222222'
const creadorId = '33333333-3333-3333-3333-333333333333'
const sucesorId = '44444444-4444-4444-4444-444444444444'

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

vi.mock('../../lib/expoPush', () => ({ sendExpoPush: vi.fn() }))

const sumado = { estado: 'confirmado', check_in_at: new Date('2026-08-21T14:05:00.000Z') }
const sinCheckIn = { estado: 'confirmado', check_in_at: null }

/**
 * `integrantes` mapea usuario_id → fila. Así el mismo mock responde por quien sale
 * y por el sucesor elegido.
 */
function armarPrisma(viaje: unknown, integrantes: Record<string, unknown>, candidatos = 0) {
  const viajeFindUnique = vi.fn().mockResolvedValue(viaje)
  const viajeUpdate = vi.fn().mockResolvedValue({})
  const integranteFindUnique = vi.fn(
    async (args: { where: { viaje_id_usuario_id: { usuario_id: string } } }) =>
      integrantes[args.where.viaje_id_usuario_id.usuario_id] ?? null
  )
  const integranteUpdate = vi.fn().mockResolvedValue({})
  const integranteUpsert = vi.fn().mockResolvedValue({})
  const integranteDelete = vi.fn().mockResolvedValue({})
  const integranteCount = vi.fn().mockResolvedValue(candidatos)
  const paradaUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
  const alertaFindMany = vi.fn().mockResolvedValue([])
  const alertaUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
  const ubicacionDeleteMany = vi.fn().mockResolvedValue({ count: 0 })

  const prisma = {
    viaje: { findUnique: viajeFindUnique, update: viajeUpdate },
    viajeIntegrante: {
      findUnique: integranteFindUnique,
      update: integranteUpdate,
      upsert: integranteUpsert,
      delete: integranteDelete,
      count: integranteCount,
    },
    usuario: { findUnique: vi.fn().mockResolvedValue({ push_token: null }) },
    parada: { updateMany: paradaUpdateMany },
    alerta: { findMany: alertaFindMany, updateMany: alertaUpdateMany },
    ubicacionViva: { deleteMany: ubicacionDeleteMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  } as unknown as PrismaClient

  return {
    viajeUpdate,
    integranteUpdate,
    integranteUpsert,
    integranteDelete,
    integranteCount,
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
  nombre: 'Salida',
  fecha_inicio_real: new Date('2026-08-21T14:00:00.000Z'),
}
const viajePlanificado = { ...viajeGrupalEnCurso, estado: 'planificado', fecha_inicio_real: null }

function estadoActualizado(m: ReturnType<typeof armarPrisma>): {
  estado: string
  fecha_salida: Date | null
} {
  const args = m.integranteUpdate.mock.calls.at(-1)![0] as {
    data: { estado: string; fecha_salida: Date | null }
  }
  return args.data
}

describe('ViajesService.salirViaje — participante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('en curso y sumado: queda salido (no se borra la fila)', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [usuarioId]: sumado })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(usuarioId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'salido' })
    expect(m.integranteDelete).not.toHaveBeenCalled()
    const data = estadoActualizado(m)
    expect(data.estado).toBe('salido')
    expect(data.fecha_salida).toBeInstanceOf(Date)
  })

  it('al salir de un viaje en curso cierra su parada, resuelve sus alertas y lo saca del mapa', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [usuarioId]: sumado })
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
    expect(emit).toHaveBeenCalledWith('viaje:participante_salio', {
      viajeId,
      usuarioId,
      estado: 'salido',
    })
  })

  it('RN-029c: en curso sin check-in ("No voy a ir") queda ausente y no toca nada en vivo', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [usuarioId]: sinCheckIn })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(usuarioId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'ausente' })
    expect(estadoActualizado(m)).toMatchObject({ estado: 'ausente', fecha_salida: null })
    expect(m.ubicacionDeleteMany).not.toHaveBeenCalled()
    expect(limpiarIntegrante).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('viaje:participante_salio', {
      viajeId,
      usuarioId,
      estado: 'ausente',
    })
  })

  it('RN-029c: bajarse antes del inicio lo deja rechazado (no le figura en el historial)', async () => {
    const m = armarPrisma(viajePlanificado, { [usuarioId]: sinCheckIn })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(usuarioId, viajeId)

    expect(result).toEqual({ viaje_id: viajeId, accion: 'rechazado' })
    expect(estadoActualizado(m)).toMatchObject({ estado: 'rechazado', fecha_salida: null })
    expect(m.ubicacionDeleteMany).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('rechaza abandonar un viaje individual', async () => {
    const m = armarPrisma({ ...viajeGrupalEnCurso, es_grupal: false }, { [usuarioId]: sumado })
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INDIVIDUAL_TRIP',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('rechaza a quien no es participante confirmado', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [usuarioId]: { estado: 'pendiente', check_in_at: null } })
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_PARTICIPANT',
    })
  })

  it('404 si el viaje no existe', async () => {
    const m = armarPrisma(null, {})
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(usuarioId, viajeId)).rejects.toBeInstanceOf(HttpError)
  })
})

describe('ViajesService.salirViaje — líder (RN-029d)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sin sucesor y con otros sumados: exige elegir a quién ceder', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [creadorId]: sumado }, 2)
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 400,
      code: 'LEADER_MUST_TRANSFER',
    })
    expect(m.integranteUpdate).not.toHaveBeenCalled()
  })

  it('en curso sin nadie más sumado: tiene que finalizar', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [creadorId]: sumado }, 0)
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'LEADER_LAST_MEMBER',
    })
    // En curso solo cuentan como sucesores quienes ya se sumaron.
    expect(m.integranteCount).toHaveBeenCalledWith({
      where: {
        viaje_id: viajeId,
        usuario_id: { not: creadorId },
        estado: 'confirmado',
        check_in_at: { not: null },
      },
    })
  })

  it('en curso con sucesor sumado: cede, queda salido y se cierra su situación en vivo', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [creadorId]: sumado, [sucesorId]: sumado })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(creadorId, viajeId, { nuevo_lider_id: sucesorId })

    expect(result).toEqual({ viaje_id: viajeId, accion: 'salido' })
    expect(m.viajeUpdate).toHaveBeenCalledWith({
      where: { id: viajeId },
      data: { creador_id: sucesorId },
    })
    expect(estadoActualizado(m).estado).toBe('salido')
    expect(limpiarIntegrante).toHaveBeenCalledWith(viajeId, creadorId)
    expect(emit).toHaveBeenCalledWith('viaje:lider_cambiado', {
      viajeId,
      liderAnteriorId: creadorId,
      liderNuevoId: sucesorId,
    })
  })

  it('en curso no puede ceder a alguien que no se sumó', async () => {
    const m = armarPrisma(viajeGrupalEnCurso, { [creadorId]: sumado, [sucesorId]: sinCheckIn })
    const service = new ViajesService(m.prisma)

    await expect(
      service.salirViaje(creadorId, viajeId, { nuevo_lider_id: sucesorId })
    ).rejects.toMatchObject({ status: 409, code: 'NOT_CHECKED_IN' })
    expect(m.viajeUpdate).not.toHaveBeenCalled()
  })

  it('planificado: cede a un confirmado y queda rechazado', async () => {
    const m = armarPrisma(viajePlanificado, { [creadorId]: sinCheckIn, [sucesorId]: sinCheckIn })
    const service = new ViajesService(m.prisma)

    const result = await service.salirViaje(creadorId, viajeId, { nuevo_lider_id: sucesorId })

    expect(result).toEqual({ viaje_id: viajeId, accion: 'rechazado' })
    expect(m.viajeUpdate).toHaveBeenCalledWith({
      where: { id: viajeId },
      data: { creador_id: sucesorId },
    })
    expect(estadoActualizado(m).estado).toBe('rechazado')
  })

  it('planificado sin otro confirmado: tiene que eliminar el viaje', async () => {
    const m = armarPrisma(viajePlanificado, { [creadorId]: sinCheckIn }, 0)
    const service = new ViajesService(m.prisma)

    await expect(service.salirViaje(creadorId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'LEADER_LAST_MEMBER',
    })
  })
})
