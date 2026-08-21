import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { ParadasService } from './paradas.service'

const viajeId = '11111111-1111-1111-1111-111111111111'
const liderId = '22222222-2222-2222-2222-222222222222'
const integranteId = '33333333-3333-3333-3333-333333333333'
const solicitudId = '44444444-4444-4444-4444-444444444444'
const paradaId = '55555555-5555-5555-5555-555555555555'

const emit = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({ to: () => ({ emit: (...args: unknown[]) => emit(...args) }) }),
}))

const sendExpoPush = vi.fn()
vi.mock('../../lib/expoPush', () => ({
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}))

const usuario = { id: integranteId, nombre: 'Ana', apellido: 'Pérez', push_token: null }

type Mocks = ReturnType<typeof armarPrisma>

function armarPrisma(overrides: Record<string, unknown> = {}) {
  const viajeFindUnique = vi.fn().mockResolvedValue({
    creador_id: liderId,
    estado: 'en_curso',
    creador: { push_token: null },
  })
  const integranteFindUnique = vi.fn().mockResolvedValue({ estado: 'confirmado' })
  const paradaFindFirst = vi.fn().mockResolvedValue(null)
  const paradaCreate = vi.fn().mockResolvedValue({
    id: paradaId,
    viaje_id: viajeId,
    usuario_id: integranteId,
    lat: -31.42,
    lng: -64.18,
    categoria: 'combustible',
    inicio: new Date('2026-08-21T14:00:00.000Z'),
    fin: null,
    usuario,
  })
  const paradaUpdate = vi.fn()
  const solicitudFindFirst = vi.fn().mockResolvedValue(null)
  const solicitudFindUnique = vi.fn()
  const solicitudCreate = vi.fn().mockResolvedValue({
    id: solicitudId,
    viaje_id: viajeId,
    solicitante_id: integranteId,
    lat: null,
    lng: null,
    motivo: 'necesito cargar nafta',
    estado: 'pendiente',
    created_at: new Date('2026-08-21T14:00:00.000Z'),
    resolved_at: null,
    solicitante: usuario,
  })
  const solicitudUpdate = vi.fn()
  const usuarioFindUnique = vi.fn().mockResolvedValue({ push_token: null })
  const integranteFindMany = vi.fn().mockResolvedValue([])

  const prisma = {
    viaje: { findUnique: viajeFindUnique },
    viajeIntegrante: { findUnique: integranteFindUnique, findMany: integranteFindMany },
    parada: { findFirst: paradaFindFirst, create: paradaCreate, update: paradaUpdate },
    solicitudParada: {
      findFirst: solicitudFindFirst,
      findUnique: solicitudFindUnique,
      create: solicitudCreate,
      update: solicitudUpdate,
      findMany: vi.fn().mockResolvedValue([]),
    },
    usuario: { findUnique: usuarioFindUnique },
    ...overrides,
  } as unknown as PrismaClient

  return {
    prisma,
    viajeFindUnique,
    integranteFindUnique,
    integranteFindMany,
    paradaFindFirst,
    paradaCreate,
    paradaUpdate,
    solicitudFindFirst,
    solicitudFindUnique,
    solicitudCreate,
    solicitudUpdate,
    usuarioFindUnique,
  }
}

function eventos(): string[] {
  return emit.mock.calls.map((c) => String(c[0]))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ------------------------------------------------------------------------ US1

describe('US1 — registrar parada voluntaria', () => {
  it('registra hora, ubicación y categoría, y avisa al grupo', async () => {
    const m = armarPrisma()
    const service = new ParadasService(m.prisma)

    const parada = await service.iniciarParada(integranteId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      categoria: 'combustible',
    })

    expect(m.paradaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viaje_id: viajeId,
          usuario_id: integranteId,
          lat: -31.42,
          lng: -64.18,
          categoria: 'combustible',
          tipo: 'voluntaria',
        }),
      })
    )
    expect(parada.inicio).toBe('2026-08-21T14:00:00.000Z')
    expect(parada.fin).toBeNull()
    expect(eventos()).toContain('viaje:parada_iniciada')
  })

  it('emite el estado detenido_voluntario para el mapa del grupo', async () => {
    const m = armarPrisma()
    await new ParadasService(m.prisma).iniciarParada(integranteId, viajeId, {
      lat: -31.42,
      lng: -64.18,
      categoria: 'descanso',
    })

    const payload = emit.mock.calls.find((c) => c[0] === 'viaje:parada_iniciada')?.[1] as {
      estado: string
      usuarioId: string
    }
    expect(payload.estado).toBe('detenido_voluntario')
    expect(payload.usuarioId).toBe(integranteId)
  })

  it('rechaza una segunda parada si ya hay una abierta', async () => {
    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId })
    const service = new ParadasService(m.prisma)

    await expect(
      service.iniciarParada(integranteId, viajeId, {
        lat: -31.42,
        lng: -64.18,
        categoria: 'descanso',
      })
    ).rejects.toMatchObject({ status: 409, code: 'PARADA_ABIERTA' })
    expect(m.paradaCreate).not.toHaveBeenCalled()
  })

  it('rechaza a quien no participa del viaje (RN-030)', async () => {
    const m = armarPrisma()
    m.integranteFindUnique.mockResolvedValue(null)
    const service = new ParadasService(m.prisma)

    await expect(
      service.iniciarParada(integranteId, viajeId, {
        lat: -31.42,
        lng: -64.18,
        categoria: 'otro',
      })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rechaza registrar paradas si el viaje no está en curso', async () => {
    const m = armarPrisma()
    m.viajeFindUnique.mockResolvedValue({ creador_id: liderId, estado: 'planificado' })
    const service = new ParadasService(m.prisma)

    await expect(
      service.iniciarParada(integranteId, viajeId, {
        lat: -31.42,
        lng: -64.18,
        categoria: 'otro',
      })
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' })
  })

  it('no voltea la request si el push falla', async () => {
    const m = armarPrisma()
    sendExpoPush.mockRejectedValueOnce(new Error('Expo caído'))
    const service = new ParadasService(m.prisma)

    await expect(
      service.iniciarParada(integranteId, viajeId, {
        lat: -31.42,
        lng: -64.18,
        categoria: 'descanso',
      })
    ).resolves.toBeTruthy()
  })
})

// ------------------------------------------------------------------------ US3

describe('US3 — retomar el viaje', () => {
  it('cierra la parada y calcula la duración total', async () => {
    const inicio = new Date('2026-08-21T14:00:00.000Z')
    const fin = new Date('2026-08-21T14:12:30.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(fin)

    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId, inicio, fin: null })
    m.paradaUpdate.mockResolvedValue({
      id: paradaId,
      viaje_id: viajeId,
      usuario_id: integranteId,
      lat: -31.42,
      lng: -64.18,
      categoria: 'descanso',
      inicio,
      fin,
      usuario,
    })

    const parada = await new ParadasService(m.prisma).finalizarParada(integranteId, viajeId)

    expect(parada.duracion_segundos).toBe(750)
    expect(parada.fin).toBe(fin.toISOString())
    vi.useRealTimers()
  })

  it('emite el paso a en_movimiento con la duración', async () => {
    const inicio = new Date('2026-08-21T14:00:00.000Z')
    const fin = new Date('2026-08-21T14:05:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(fin)

    const m = armarPrisma()
    m.paradaFindFirst.mockResolvedValue({ id: paradaId, inicio, fin: null })
    m.paradaUpdate.mockResolvedValue({
      id: paradaId,
      viaje_id: viajeId,
      usuario_id: integranteId,
      lat: -31.42,
      lng: -64.18,
      categoria: null,
      inicio,
      fin,
      usuario,
    })

    await new ParadasService(m.prisma).finalizarParada(integranteId, viajeId)

    const payload = emit.mock.calls.find((c) => c[0] === 'viaje:parada_finalizada')?.[1] as {
      estado: string
      duracionSegundos: number
    }
    expect(payload.estado).toBe('en_movimiento')
    expect(payload.duracionSegundos).toBe(300)
    vi.useRealTimers()
  })

  it('falla si no hay ninguna parada abierta', async () => {
    const m = armarPrisma()
    const service = new ParadasService(m.prisma)

    await expect(service.finalizarParada(integranteId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'SIN_PARADA_ABIERTA',
    })
  })
})

// ------------------------------------------------------------------------ US2

describe('US2 — solicitar parada al líder', () => {
  it('crea la solicitud pendiente y notifica al líder', async () => {
    const m = armarPrisma()
    m.usuarioFindUnique.mockResolvedValue({ push_token: 'ExponentPushToken[lider]' })
    const service = new ParadasService(m.prisma)

    const solicitud = await service.solicitarParada(integranteId, viajeId, {
      motivo: 'necesito cargar nafta',
    })

    expect(solicitud.estado).toBe('pendiente')
    expect(eventos()).toContain('viaje:solicitud_parada')
    await vi.waitFor(() =>
      expect(sendExpoPush).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'ExponentPushToken[lider]', title: 'Solicitud de parada' }),
      ])
    )
  })

  it('impide que el líder se solicite una parada a sí mismo', async () => {
    const m = armarPrisma()
    const service = new ParadasService(m.prisma)

    await expect(service.solicitarParada(liderId, viajeId, {})).rejects.toMatchObject({
      status: 409,
      code: 'ES_LIDER',
    })
  })

  it('impide dos solicitudes pendientes del mismo integrante', async () => {
    const m = armarPrisma()
    m.solicitudFindFirst.mockResolvedValue({ id: solicitudId })
    const service = new ParadasService(m.prisma)

    await expect(service.solicitarParada(integranteId, viajeId, {})).rejects.toMatchObject({
      status: 409,
      code: 'SOLICITUD_PENDIENTE',
    })
    expect(m.solicitudCreate).not.toHaveBeenCalled()
  })

  it('solo el líder puede aprobar (RN-030)', async () => {
    const m = armarPrisma()
    const service = new ParadasService(m.prisma)

    await expect(
      service.responderSolicitud(integranteId, viajeId, solicitudId, { decision: 'aprobada' })
    ).rejects.toMatchObject({ status: 403 })
    expect(m.solicitudUpdate).not.toHaveBeenCalled()
  })

  it('el líder aprueba y el resultado le llega al solicitante', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      estado: 'pendiente',
    })
    m.solicitudUpdate.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      solicitante_id: integranteId,
      lat: null,
      lng: null,
      motivo: null,
      estado: 'aprobada',
      created_at: new Date('2026-08-21T14:00:00.000Z'),
      resolved_at: new Date('2026-08-21T14:01:00.000Z'),
      solicitante: { ...usuario, push_token: 'ExponentPushToken[ana]' },
    })

    const resultado = await new ParadasService(m.prisma).responderSolicitud(
      liderId,
      viajeId,
      solicitudId,
      { decision: 'aprobada' }
    )

    expect(resultado.estado).toBe('aprobada')
    expect(eventos()).toContain('viaje:solicitud_parada_resuelta')
    await vi.waitFor(() =>
      expect(sendExpoPush).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'ExponentPushToken[ana]', title: 'Parada aprobada' }),
      ])
    )
  })

  it('el líder rechaza y el solicitante recibe el rechazo', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      estado: 'pendiente',
    })
    m.solicitudUpdate.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      solicitante_id: integranteId,
      lat: null,
      lng: null,
      motivo: null,
      estado: 'rechazada',
      created_at: new Date('2026-08-21T14:00:00.000Z'),
      resolved_at: new Date('2026-08-21T14:01:00.000Z'),
      solicitante: { ...usuario, push_token: 'ExponentPushToken[ana]' },
    })

    const resultado = await new ParadasService(m.prisma).responderSolicitud(
      liderId,
      viajeId,
      solicitudId,
      { decision: 'rechazada' }
    )

    expect(resultado.estado).toBe('rechazada')
    await vi.waitFor(() =>
      expect(sendExpoPush).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'Parada rechazada' }),
      ])
    )
  })

  it('no permite resolver dos veces la misma solicitud', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      estado: 'aprobada',
    })

    await expect(
      new ParadasService(m.prisma).responderSolicitud(liderId, viajeId, solicitudId, {
        decision: 'rechazada',
      })
    ).rejects.toMatchObject({ status: 409, code: 'SOLICITUD_RESUELTA' })
  })

  it('rechaza una solicitud de otro viaje aunque el id exista', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: '99999999-9999-9999-9999-999999999999',
      estado: 'pendiente',
    })

    await expect(
      new ParadasService(m.prisma).responderSolicitud(liderId, viajeId, solicitudId, {
        decision: 'aprobada',
      })
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('el solicitante puede cancelar su solicitud pendiente', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      solicitante_id: integranteId,
      estado: 'pendiente',
    })
    m.solicitudUpdate.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      solicitante_id: integranteId,
      lat: null,
      lng: null,
      motivo: null,
      estado: 'cancelada',
      created_at: new Date('2026-08-21T14:00:00.000Z'),
      resolved_at: new Date('2026-08-21T14:02:00.000Z'),
    })

    const resultado = await new ParadasService(m.prisma).cancelarSolicitud(
      integranteId,
      viajeId,
      solicitudId
    )
    expect(resultado.estado).toBe('cancelada')
  })

  it('nadie puede cancelar la solicitud de otro', async () => {
    const m = armarPrisma()
    m.solicitudFindUnique.mockResolvedValue({
      id: solicitudId,
      viaje_id: viajeId,
      solicitante_id: 'otro-usuario',
      estado: 'pendiente',
    })

    await expect(
      new ParadasService(m.prisma).cancelarSolicitud(integranteId, viajeId, solicitudId)
    ).rejects.toMatchObject({ status: 403 })
  })
})
