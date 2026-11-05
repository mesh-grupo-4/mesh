import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { ViajesService } from '../viajes/viajes.service'

vi.mock('../../config/firebase', () => ({ firebaseAuth: {} }))

const desconectar = vi.fn()
vi.mock('../../realtime/ioRegistry', () => ({
  getIo: () => ({
    fetchSockets: async () => [
      { data: { userId: objetivoId }, disconnect: desconectar },
      { data: { userId: 'otra-persona' }, disconnect: vi.fn() },
    ],
  }),
}))

const { AdminService } = await import('./admin.service')
const { requireSuperadmin } = await import('../../middleware/requireSuperadmin')

const adminId = '11111111-1111-1111-1111-111111111111'
const objetivoId = '22222222-2222-2222-2222-222222222222'
const otroId = '33333333-3333-3333-3333-333333333333'
const grupoId = '44444444-4444-4444-4444-444444444444'
const viajeId = '55555555-5555-5555-5555-555555555555'

const usuarioObjetivo = {
  id: objetivoId,
  email: 'objetivo@mesh.test',
  nombre: 'Objetivo',
  firebase_uid: 'uid-objetivo',
  rol_sistema: 'usuario',
  suspendido_at: null as Date | null,
}

function armarPrisma(over: Record<string, unknown> = {}) {
  const prisma = {
    usuario: {
      findUnique: vi.fn().mockResolvedValue(usuarioObjetivo),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditoriaAdmin: { create: vi.fn().mockResolvedValue({}) },
    viaje: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    viajeIntegrante: { findFirst: vi.fn().mockResolvedValue(null) },
    grupo: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    grupoMiembro: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ usuario_id: objetivoId }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    ...over,
  } as Record<string, unknown>
  // Transacción interactiva: el callback recibe el mismo cliente fake.
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  return prisma as unknown as PrismaClient & Record<string, Record<string, ReturnType<typeof vi.fn>>>
}

function armarFirebase() {
  return {
    deshabilitar: vi.fn().mockResolvedValue(undefined),
    habilitar: vi.fn().mockResolvedValue(undefined),
    eliminar: vi.fn().mockResolvedValue(undefined),
  }
}

const viajesFake = { finalizarComoAdmin: vi.fn() }

function armar(over: Record<string, unknown> = {}) {
  const prisma = armarPrisma(over)
  const firebase = armarFirebase()
  const service = new AdminService(prisma, firebase, viajesFake as unknown as ViajesService)
  return { prisma, firebase, service }
}

function acciones(prisma: ReturnType<typeof armarPrisma>): string[] {
  return prisma.auditoriaAdmin.create.mock.calls.map((c) => (c[0] as { data: { accion: string } }).data.accion)
}

beforeEach(() => {
  vi.clearAllMocks()
  usuarioObjetivo.suspendido_at = null
})

describe('requireSuperadmin', () => {
  function correr(rol: string | undefined) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    requireSuperadmin({ rolSistema: rol } as never, res as never, next)
    return { res, next }
  }

  it('rechaza con 403 NOT_SUPERADMIN a un usuario común', () => {
    const { res, next } = correr('usuario')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_SUPERADMIN' }))
    expect(next).not.toHaveBeenCalled()
  })

  it('deja pasar al superadmin', () => {
    const { next } = correr('superadmin')
    expect(next).toHaveBeenCalled()
  })
})

describe('cambiarRolSistema (RN-122)', () => {
  it('nadie cambia su propio rol', async () => {
    const { service } = armar()
    await expect(service.cambiarRolSistema(adminId, adminId, 'usuario')).rejects.toMatchObject({
      status: 400,
      code: 'CANNOT_CHANGE_OWN_ROLE',
    })
  })

  it('otorga el rol y lo audita', async () => {
    const { service, prisma } = armar()
    await expect(service.cambiarRolSistema(adminId, objetivoId, 'superadmin')).resolves.toEqual({
      id: objetivoId,
      rol_sistema: 'superadmin',
    })
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: objetivoId },
      data: { rol_sistema: 'superadmin' },
    })
    expect(acciones(prisma)).toEqual(['usuario.cambiar_rol'])
  })
})

describe('suspenderUsuario / reactivarUsuario (RN-123)', () => {
  it('no permite suspenderse a sí mismo', async () => {
    const { service } = armar()
    await expect(service.suspenderUsuario(adminId, adminId, 'motivo')).rejects.toMatchObject({
      code: 'CANNOT_SUSPEND_SELF',
    })
  })

  it('suspende, audita, deshabilita en Firebase y corta los sockets de esa persona', async () => {
    const { service, prisma, firebase } = armar()
    const r = await service.suspenderUsuario(adminId, objetivoId, 'Spam de alertas')

    expect(r.suspendido_at).toBeInstanceOf(Date)
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: objetivoId },
      data: { suspendido_at: expect.any(Date), motivo_suspension: 'Spam de alertas' },
    })
    expect(acciones(prisma)).toEqual(['usuario.suspender'])
    expect(firebase.deshabilitar).toHaveBeenCalledWith('uid-objetivo')
    expect(desconectar).toHaveBeenCalledTimes(1)
  })

  it('la suspensión rige aunque Firebase falle', async () => {
    const { service, prisma, firebase } = armar()
    firebase.deshabilitar.mockRejectedValueOnce(new Error('firebase caído'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(service.suspenderUsuario(adminId, objetivoId, 'motivo')).resolves.toBeTruthy()
    expect(prisma.usuario.update).toHaveBeenCalled()
  })

  it('409 si ya estaba suspendida', async () => {
    usuarioObjetivo.suspendido_at = new Date()
    const { service } = armar()
    await expect(service.suspenderUsuario(adminId, objetivoId, 'motivo')).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_SUSPENDED',
    })
  })

  it('409 al reactivar una cuenta que no está suspendida', async () => {
    const { service } = armar()
    await expect(service.reactivarUsuario(adminId, objetivoId)).rejects.toMatchObject({
      code: 'NOT_SUSPENDED',
    })
  })
})

describe('eliminarUsuario (RN-124)', () => {
  it('no permite eliminarse a sí mismo', async () => {
    const { service } = armar()
    await expect(service.eliminarUsuario(adminId, adminId)).rejects.toMatchObject({
      code: 'CANNOT_DELETE_SELF',
    })
  })

  it('con un viaje en curso responde 409 sin tocar Firebase ni la base', async () => {
    const { service, prisma, firebase } = armar()
    prisma.viaje.findFirst.mockResolvedValueOnce({ id: viajeId })

    await expect(service.eliminarUsuario(adminId, objetivoId)).rejects.toMatchObject({
      status: 409,
      code: 'USER_IN_ACTIVE_TRIP',
    })
    expect(firebase.eliminar).not.toHaveBeenCalled()
    expect(prisma.usuario.delete).not.toHaveBeenCalled()
  })

  it('si Firebase falla responde 502 y no borra la fila (así no se recrea vacía)', async () => {
    const { service, prisma, firebase } = armar()
    firebase.eliminar.mockRejectedValueOnce(new Error('timeout'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(service.eliminarUsuario(adminId, objetivoId)).rejects.toMatchObject({
      status: 502,
      code: 'AUTH_PROVIDER_ERROR',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('transfiere o elimina grupos y viajes que lideraba antes de borrar la cuenta', async () => {
    const { service, prisma, firebase } = armar()
    prisma.grupo.findMany.mockResolvedValueOnce([{ id: grupoId }, { id: 'grupo-solo' }])
    prisma.grupoMiembro.findFirst
      .mockResolvedValueOnce({ usuario_id: otroId }) // grupoId: hay sucesor
      .mockResolvedValueOnce(null) // grupo-solo: no queda nadie
    prisma.viaje.findMany.mockResolvedValueOnce([{ id: viajeId }, { id: 'viaje-solo' }])
    prisma.viajeIntegrante.findFirst
      .mockResolvedValueOnce({ usuario_id: otroId })
      .mockResolvedValueOnce(null)

    const r = await service.eliminarUsuario(adminId, objetivoId)

    expect(r).toEqual({
      usuario_id: objetivoId,
      accion: 'eliminado',
      grupos_transferidos: 1,
      grupos_eliminados: 1,
      viajes_transferidos: 1,
      viajes_eliminados: 1,
    })
    expect(prisma.grupo.update).toHaveBeenCalledWith({ where: { id: grupoId }, data: { lider_id: otroId } })
    expect(prisma.grupoMiembro.update).toHaveBeenCalledWith({
      where: { grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: otroId } },
      data: { rol: 'lider' },
    })
    expect(prisma.grupo.delete).toHaveBeenCalledWith({ where: { id: 'grupo-solo' } })
    expect(prisma.viaje.update).toHaveBeenCalledWith({ where: { id: viajeId }, data: { creador_id: otroId } })
    expect(prisma.viaje.delete).toHaveBeenCalledWith({ where: { id: 'viaje-solo' } })
    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: objetivoId } })
    expect(acciones(prisma)).toEqual(['usuario.eliminar'])

    // Firebase va primero: si no, un login en el medio recrearía la cuenta.
    const ordenFirebase = firebase.eliminar.mock.invocationCallOrder[0]
    const ordenBorrado = prisma.usuario.delete.mock.invocationCallOrder[0]
    expect(ordenFirebase).toBeLessThan(ordenBorrado)
  })
})

describe('grupos', () => {
  it('quitar al líder transfiere el rol al integrante más antiguo (RN-013)', async () => {
    const { service, prisma } = armar()
    prisma.grupo.findUnique.mockResolvedValueOnce({ lider_id: objetivoId, nombre: 'G' })
    prisma.grupoMiembro.findFirst.mockResolvedValueOnce({ usuario_id: otroId })

    const r = await service.quitarMiembro(adminId, grupoId, objetivoId)

    expect(r).toEqual({ grupo_id: grupoId, usuario_id: objetivoId, accion: 'quitado', lider_id: otroId })
    expect(prisma.grupo.update).toHaveBeenCalledWith({ where: { id: grupoId }, data: { lider_id: otroId } })
    expect(prisma.grupoMiembro.delete).toHaveBeenCalled()
    expect(acciones(prisma)).toEqual(['grupo.quitar_miembro'])
  })

  it('quitar al líder que estaba solo elimina el grupo', async () => {
    const { service, prisma } = armar()
    prisma.grupo.findUnique.mockResolvedValueOnce({ lider_id: objetivoId, nombre: 'G' })

    const r = await service.quitarMiembro(adminId, grupoId, objetivoId)

    expect(r.accion).toBe('grupo_eliminado')
    expect(prisma.grupo.delete).toHaveBeenCalledWith({ where: { id: grupoId } })
  })

  it('reasignar líder exige que la persona sea integrante', async () => {
    const { service, prisma } = armar()
    prisma.grupo.findUnique.mockResolvedValueOnce({ lider_id: otroId, nombre: 'G' })
    prisma.grupoMiembro.findUnique.mockResolvedValueOnce(null)

    await expect(service.reasignarLider(adminId, grupoId, objetivoId)).rejects.toMatchObject({
      code: 'MEMBER_NOT_FOUND',
    })
  })
})

describe('viajes', () => {
  it('no elimina un viaje en curso', async () => {
    const { service, prisma } = armar()
    prisma.viaje.findUnique.mockResolvedValueOnce({ nombre: 'V', estado: 'en_curso', creador_id: otroId })

    await expect(service.eliminarViaje(adminId, viajeId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    })
    expect(prisma.viaje.delete).not.toHaveBeenCalled()
  })

  it('finalizar forzado delega en ViajesService y lo audita', async () => {
    const { service, prisma } = armar()
    const fin = new Date('2026-10-16T18:30:00.000Z')
    viajesFake.finalizarComoAdmin.mockResolvedValueOnce({
      nombre: 'V',
      creador_id: otroId,
      estado: 'finalizado',
      fecha_fin_real: fin,
    })

    await expect(service.finalizarViaje(adminId, viajeId)).resolves.toEqual({
      viaje_id: viajeId,
      estado: 'finalizado',
      fecha_fin_real: fin,
    })
    expect(viajesFake.finalizarComoAdmin).toHaveBeenCalledWith(viajeId)
    expect(acciones(prisma)).toEqual(['viaje.finalizar'])
  })
})
