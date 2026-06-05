import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { GruposService } from './grupos.service'
import { HttpError } from '../../lib/httpError'

const creadorId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const terceroId = '44444444-4444-4444-4444-444444444444'
const grupoId = '33333333-3333-3333-3333-333333333333'

function createMockPrisma() {
  const grupoCreate = vi.fn()
  const grupoMiembroCreate = vi.fn()
  const usuarioFindUnique = vi.fn()
  const grupoFindUnique = vi.fn()

  const tx = {
    grupo: { create: grupoCreate },
    grupoMiembro: { create: grupoMiembroCreate },
  }

  const prisma = {
    usuario: { findUnique: usuarioFindUnique },
    grupo: { findUnique: grupoFindUnique },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  }

  return {
    prisma: prisma as unknown as PrismaClient,
    grupoCreate,
    grupoMiembroCreate,
    usuarioFindUnique,
    grupoFindUnique,
  }
}

describe('GruposService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('crearGrupo', () => {
    it('crea grupo y miembro con rol lider en transacción', async () => {
      const { prisma, usuarioFindUnique, grupoCreate, grupoMiembroCreate } = createMockPrisma()

      usuarioFindUnique.mockResolvedValue({ id: creadorId, email: 'a@test.com', nombre: 'Ana' })
      grupoCreate.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: new Date('2026-05-29T12:00:00Z'),
        lider_id: creadorId,
      })
      grupoMiembroCreate.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.crearGrupo(creadorId, { nombre: 'Trail Riders' })

      expect(result).toEqual({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: new Date('2026-05-29T12:00:00Z'),
        lider_id: creadorId,
      })
      expect(grupoCreate).toHaveBeenCalledWith({
        data: { nombre: 'Trail Riders', lider_id: creadorId },
        select: expect.objectContaining({ id: true, nombre: true }),
      })
      expect(grupoMiembroCreate).toHaveBeenCalledWith({
        data: { grupo_id: grupoId, usuario_id: creadorId, rol: 'lider' },
      })
    })

    it('lanza 404 si el usuario no existe', async () => {
      const { prisma, usuarioFindUnique } = createMockPrisma()
      usuarioFindUnique.mockResolvedValue(null)

      const service = new GruposService(prisma)

      await expect(service.crearGrupo(creadorId, { nombre: 'Test' })).rejects.toMatchObject({
        status: 404,
        code: 'USER_NOT_FOUND',
      })
    })
  })

  describe('listarParaUsuario', () => {
    it('devuelve grupos del usuario ordenados', async () => {
      const fecha = new Date('2026-05-29T12:00:00Z')
      const prisma = {
        grupo: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: grupoId,
              nombre: 'Trail Riders',
              fecha_creacion: fecha,
              lider_id: creadorId,
              miembros: [{ rol: 'lider' }],
            },
          ]),
        },
      } as unknown as import('@prisma/client').PrismaClient

      const service = new GruposService(prisma)
      const result = await service.listarParaUsuario(creadorId)

      expect(result).toHaveLength(1)
      expect(result[0]?.mi_rol).toBe('lider')
    })
  })

  describe('detalleParaMiembro', () => {
    it('devuelve detalle si el usuario es líder', async () => {
      const { prisma, grupoFindUnique } = createMockPrisma()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })

      const service = new GruposService(prisma)
      const result = await service.detalleParaMiembro(creadorId, grupoId)

      expect(result).toEqual({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        mi_rol: 'lider',
      })
    })

    it('devuelve detalle si el usuario es participante', async () => {
      const { prisma, grupoFindUnique } = createMockPrisma()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'participante' }],
      })

      const service = new GruposService(prisma)
      const result = await service.detalleParaMiembro(otroId, grupoId)

      expect(result.mi_rol).toBe('participante')
    })

    it('lanza 404 si el grupo no existe', async () => {
      const { prisma, grupoFindUnique } = createMockPrisma()
      grupoFindUnique.mockResolvedValue(null)

      const service = new GruposService(prisma)

      await expect(service.detalleParaMiembro(creadorId, grupoId)).rejects.toMatchObject({
        status: 404,
        code: 'GRUPO_NOT_FOUND',
      })
    })

    it('lanza 403 si el usuario no es miembro', async () => {
      const { prisma, grupoFindUnique } = createMockPrisma()

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: new Date(),
        lider_id: creadorId,
        miembros: [],
      })

      const service = new GruposService(prisma)

      await expect(service.detalleParaMiembro(otroId, grupoId)).rejects.toBeInstanceOf(HttpError)
      await expect(service.detalleParaMiembro(otroId, grupoId)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_MEMBER',
      })
    })
  })

  describe('listarMiembros', () => {
    it('devuelve miembros si el actor pertenece al grupo', async () => {
      const fecha = new Date('2026-05-29T12:00:00Z')
      const { prisma, grupoFindUnique } = createMockPrisma()

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })

      const grupoMiembroFindMany = vi.fn().mockResolvedValue([
        {
          rol: 'lider',
          fecha_union: fecha,
          usuario: { id: creadorId, nombre: 'Ana', email: 'ana@test.com' },
        },
        {
          rol: 'participante',
          fecha_union: new Date('2026-05-30T12:00:00Z'),
          usuario: { id: otroId, nombre: 'Bruno', email: 'bruno@test.com' },
        },
      ])

      Object.assign(prisma, {
        grupoMiembro: { findMany: grupoMiembroFindMany },
      })

      const service = new GruposService(prisma)
      const result = await service.listarMiembros(creadorId, grupoId)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: creadorId,
        nombre: 'Ana',
        email: 'ana@test.com',
        rol: 'lider',
        fecha_union: fecha,
      })
    })

    it('lanza 403 si el actor no es miembro', async () => {
      const { prisma, grupoFindUnique } = createMockPrisma()

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: new Date(),
        lider_id: creadorId,
        miembros: [],
      })

      const service = new GruposService(prisma)

      await expect(service.listarMiembros(otroId, grupoId)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_MEMBER',
      })
    })
  })

  describe('cambiarRolMiembro', () => {
    function createCambiarRolMocks() {
      const grupoFindUnique = vi.fn()
      const grupoMiembroFindUnique = vi.fn()
      const grupoUpdate = vi.fn()
      const grupoMiembroUpdate = vi.fn()

      const tx = {
        grupo: { update: grupoUpdate },
        grupoMiembro: { update: grupoMiembroUpdate },
      }

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        grupoMiembro: {
          findUnique: grupoMiembroFindUnique,
          update: grupoMiembroUpdate,
        },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
        grupoMiembroFindUnique,
        grupoUpdate,
        grupoMiembroUpdate,
      }
    }

    it('participante no puede cambiar roles', async () => {
      const { prisma, grupoFindUnique } = createCambiarRolMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })

      const service = new GruposService(prisma)

      await expect(
        service.cambiarRolMiembro(otroId, grupoId, terceroId, { rol: 'participante' })
      ).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_LEADER',
      })
    })

    it('no permite cambiar el propio rol', async () => {
      const { prisma, grupoFindUnique } = createCambiarRolMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })

      const service = new GruposService(prisma)

      await expect(
        service.cambiarRolMiembro(creadorId, grupoId, creadorId, { rol: 'participante' })
      ).rejects.toMatchObject({
        status: 400,
        code: 'CANNOT_CHANGE_OWN_ROLE',
      })
    })

    it('líder transfiere liderazgo a otro miembro', async () => {
      const {
        prisma,
        grupoFindUnique,
        grupoMiembroFindUnique,
        grupoUpdate,
        grupoMiembroUpdate,
      } = createCambiarRolMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      grupoMiembroFindUnique.mockResolvedValue({ rol: 'participante' })
      grupoUpdate.mockResolvedValue({})
      grupoMiembroUpdate.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.cambiarRolMiembro(creadorId, grupoId, otroId, {
        rol: 'lider',
      })

      expect(result).toEqual({ usuario_id: otroId, rol: 'lider' })
      expect(grupoUpdate).toHaveBeenCalledWith({
        where: { id: grupoId },
        data: { lider_id: otroId },
      })
      expect(grupoMiembroUpdate).toHaveBeenCalledWith({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: otroId },
        },
        data: { rol: 'lider' },
      })
      expect(grupoMiembroUpdate).toHaveBeenCalledWith({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: creadorId },
        },
        data: { rol: 'participante' },
      })
    })

    it('devuelve el rol actual si no hay cambio', async () => {
      const { prisma, grupoFindUnique, grupoMiembroFindUnique } = createCambiarRolMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      grupoMiembroFindUnique.mockResolvedValue({ rol: 'participante' })

      const service = new GruposService(prisma)
      const result = await service.cambiarRolMiembro(creadorId, grupoId, otroId, {
        rol: 'participante',
      })

      expect(result).toEqual({ usuario_id: otroId, rol: 'participante' })
    })
  })

  describe('abandonarGrupo', () => {
    function createAbandonarMocks() {
      const grupoFindUnique = vi.fn()
      const grupoMiembroDelete = vi.fn()
      const grupoMiembroCount = vi.fn()
      const grupoMiembroFindUnique = vi.fn()
      const viajeFindFirst = vi.fn()
      const viajeDeleteMany = vi.fn()
      const grupoDelete = vi.fn()
      const grupoUpdate = vi.fn()
      const grupoMiembroUpdate = vi.fn()

      const tx = {
        viaje: { deleteMany: viajeDeleteMany },
        grupo: { delete: grupoDelete, update: grupoUpdate },
        grupoMiembro: { delete: grupoMiembroDelete, update: grupoMiembroUpdate },
      }

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        grupoMiembro: {
          delete: grupoMiembroDelete,
          count: grupoMiembroCount,
          findUnique: grupoMiembroFindUnique,
          update: grupoMiembroUpdate,
        },
        viaje: { findFirst: viajeFindFirst },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
        grupoMiembroDelete,
        grupoMiembroCount,
        grupoMiembroFindUnique,
        viajeFindFirst,
        viajeDeleteMany,
        grupoDelete,
        grupoUpdate,
        grupoMiembroUpdate,
      }
    }

    it('participante abandona el grupo', async () => {
      const { prisma, grupoFindUnique, grupoMiembroDelete } = createAbandonarMocks()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'participante' }],
      })
      grupoMiembroDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.abandonarGrupo(otroId, grupoId)

      expect(result).toEqual({ accion: 'abandonado' })
      expect(grupoMiembroDelete).toHaveBeenCalledWith({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: otroId },
        },
      })
    })

    it('no-miembro recibe 403', async () => {
      const { prisma, grupoFindUnique } = createAbandonarMocks()

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: new Date(),
        lider_id: creadorId,
        miembros: [],
      })

      const service = new GruposService(prisma)

      await expect(service.abandonarGrupo(otroId, grupoId)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_MEMBER',
      })
    })

    it('líder único elimina el grupo al abandonar', async () => {
      const {
        prisma,
        grupoFindUnique,
        grupoMiembroCount,
        viajeFindFirst,
        viajeDeleteMany,
        grupoDelete,
      } = createAbandonarMocks()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })
      viajeFindFirst.mockResolvedValue(null)
      grupoMiembroCount.mockResolvedValue(0)
      viajeDeleteMany.mockResolvedValue({ count: 0 })
      grupoDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.abandonarGrupo(creadorId, grupoId)

      expect(result).toEqual({ accion: 'grupo_eliminado', grupo_id: grupoId })
      expect(viajeDeleteMany).toHaveBeenCalled()
      expect(grupoDelete).toHaveBeenCalledWith({ where: { id: grupoId } })
    })

    it('líder con miembros sin nuevo_lider_id recibe 400', async () => {
      const { prisma, grupoFindUnique, grupoMiembroCount, viajeFindFirst } = createAbandonarMocks()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })
      viajeFindFirst.mockResolvedValue(null)
      grupoMiembroCount.mockResolvedValue(2)

      const service = new GruposService(prisma)

      await expect(service.abandonarGrupo(creadorId, grupoId)).rejects.toMatchObject({
        status: 400,
        code: 'LEADER_MUST_TRANSFER',
      })
    })

    it('líder transfiere y abandona en transacción', async () => {
      const {
        prisma,
        grupoFindUnique,
        grupoMiembroCount,
        grupoMiembroFindUnique,
        viajeFindFirst,
        grupoUpdate,
        grupoMiembroUpdate,
        grupoMiembroDelete,
      } = createAbandonarMocks()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })
      viajeFindFirst.mockResolvedValue(null)
      grupoMiembroCount.mockResolvedValue(1)
      grupoMiembroFindUnique.mockResolvedValue({ rol: 'participante' })
      grupoUpdate.mockResolvedValue({})
      grupoMiembroUpdate.mockResolvedValue({})
      grupoMiembroDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.abandonarGrupo(creadorId, grupoId, {
        nuevo_lider_id: otroId,
      })

      expect(result).toEqual({ accion: 'abandonado' })
      expect(grupoUpdate).toHaveBeenCalledWith({
        where: { id: grupoId },
        data: { lider_id: otroId },
      })
      expect(grupoMiembroDelete).toHaveBeenCalledWith({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: creadorId },
        },
      })
    })

    it('nuevo_lider_id inválido recibe 404', async () => {
      const { prisma, grupoFindUnique, grupoMiembroCount, grupoMiembroFindUnique, viajeFindFirst } =
        createAbandonarMocks()
      const fecha = new Date('2026-05-29T12:00:00Z')

      grupoFindUnique.mockResolvedValue({
        id: grupoId,
        nombre: 'Trail Riders',
        fecha_creacion: fecha,
        lider_id: creadorId,
        miembros: [{ rol: 'lider' }],
      })
      viajeFindFirst.mockResolvedValue(null)
      grupoMiembroCount.mockResolvedValue(1)
      grupoMiembroFindUnique.mockResolvedValue(null)

      const service = new GruposService(prisma)

      await expect(
        service.abandonarGrupo(creadorId, grupoId, { nuevo_lider_id: terceroId })
      ).rejects.toMatchObject({
        status: 404,
        code: 'MEMBER_NOT_FOUND',
      })
    })
  })

  describe('eliminarGrupo', () => {
    function createEliminarMocks() {
      const grupoFindUnique = vi.fn()
      const viajeFindFirst = vi.fn()
      const viajeDeleteMany = vi.fn()
      const grupoDelete = vi.fn()

      const tx = {
        viaje: { deleteMany: viajeDeleteMany },
        grupo: { delete: grupoDelete },
      }

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        viaje: { findFirst: viajeFindFirst },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
        viajeFindFirst,
        viajeDeleteMany,
        grupoDelete,
      }
    }

    it('solo el líder puede eliminar el grupo', async () => {
      const { prisma, grupoFindUnique } = createEliminarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })

      const service = new GruposService(prisma)

      await expect(service.eliminarGrupo(otroId, grupoId)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_LEADER',
      })
    })

    it('eliminar con viaje en_curso recibe 409', async () => {
      const { prisma, grupoFindUnique, viajeFindFirst } = createEliminarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue({ id: 'viaje-1' })

      const service = new GruposService(prisma)

      await expect(service.eliminarGrupo(creadorId, grupoId)).rejects.toMatchObject({
        status: 409,
        code: 'TRIP_IN_PROGRESS',
      })
    })

    it('líder elimina grupo y viajes planificados', async () => {
      const { prisma, grupoFindUnique, viajeFindFirst, viajeDeleteMany, grupoDelete } =
        createEliminarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue(null)
      viajeDeleteMany.mockResolvedValue({ count: 2 })
      grupoDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.eliminarGrupo(creadorId, grupoId)

      expect(result).toEqual({ accion: 'grupo_eliminado', grupo_id: grupoId })
      expect(viajeDeleteMany).toHaveBeenCalledWith({
        where: { grupo_id: grupoId, estado: 'planificado' },
      })
      expect(grupoDelete).toHaveBeenCalledWith({ where: { id: grupoId } })
    })
  })
})
