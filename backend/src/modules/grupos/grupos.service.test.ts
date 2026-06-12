import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { GruposService } from './grupos.service'
import { HttpError } from '../../lib/httpError'

const creadorId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const terceroId = '44444444-4444-4444-4444-444444444444'
const grupoId = '33333333-3333-3333-3333-333333333333'
const grupoOrigenId = '55555555-5555-5555-5555-555555555555'

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
      grupoMiembroCount.mockResolvedValue(0)
      grupoDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.abandonarGrupo(creadorId, grupoId)

      expect(result).toEqual({ accion: 'grupo_eliminado', grupo_id: grupoId })
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

  describe('listarGruposParaInvitar', () => {
    function createInvitarMocks() {
      const grupoFindUnique = vi.fn()
      const viajeFindFirst = vi.fn()
      const grupoFindMany = vi.fn()

      const prisma = {
        grupo: { findUnique: grupoFindUnique, findMany: grupoFindMany },
        viaje: { findFirst: viajeFindFirst },
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
        viajeFindFirst,
        grupoFindMany,
      }
    }

    it('devuelve otros grupos del usuario con conteo de integrantes', async () => {
      const { prisma, grupoFindUnique, viajeFindFirst, grupoFindMany } = createInvitarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue(null)
      grupoFindMany.mockResolvedValue([
        { id: grupoOrigenId, nombre: 'Club Bici', _count: { miembros: 5 } },
      ])

      const service = new GruposService(prisma)
      const result = await service.listarGruposParaInvitar(creadorId, grupoId)

      expect(result).toEqual([
        { id: grupoOrigenId, nombre: 'Club Bici', cantidad_integrantes: 5 },
      ])
      expect(grupoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: grupoId },
          }),
        })
      )
    })

    it('participante no puede listar grupos para invitar', async () => {
      const { prisma, grupoFindUnique } = createInvitarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })

      const service = new GruposService(prisma)

      await expect(service.listarGruposParaInvitar(otroId, grupoId)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_LEADER',
      })
    })
  })

  describe('invitarDesdeGrupos', () => {
    function createBulkInviteMocks() {
      const grupoFindUnique = vi.fn()
      const viajeFindFirst = vi.fn()
      const grupoFindMany = vi.fn()
      const grupoMiembroFindMany = vi.fn()
      const grupoInvitacionFindMany = vi.fn().mockResolvedValue([])
      const grupoInvitacionUpsert = vi.fn().mockResolvedValue({})

      const tx = {
        grupoMiembro: { findMany: grupoMiembroFindMany },
        grupoInvitacion: { upsert: grupoInvitacionUpsert },
      }

      const prisma = {
        grupo: { findUnique: grupoFindUnique, findMany: grupoFindMany },
        viaje: { findFirst: viajeFindFirst },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        grupoInvitacion: { findMany: grupoInvitacionFindMany },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
        viajeFindFirst,
        grupoFindMany,
        grupoMiembroFindMany,
        grupoInvitacionFindMany,
        grupoInvitacionUpsert,
      }
    }

    it('crea invitaciones masivas excluyendo al invitador y miembros existentes', async () => {
      const {
        prisma,
        grupoFindUnique,
        viajeFindFirst,
        grupoFindMany,
        grupoMiembroFindMany,
        grupoInvitacionUpsert,
      } = createBulkInviteMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue(null)
      grupoFindMany.mockResolvedValue([
        {
          id: grupoOrigenId,
          nombre: 'Club Bici',
          lider_id: creadorId,
          miembros: [{ usuario_id: creadorId }],
        },
      ])
      grupoMiembroFindMany
        .mockResolvedValueOnce([{ usuario_id: creadorId }, { usuario_id: otroId }])
        .mockResolvedValueOnce([
          { usuario_id: otroId },
          { usuario_id: terceroId },
        ])

      const service = new GruposService(prisma)
      const result = await service.invitarDesdeGrupos(creadorId, grupoId, {
        grupo_origen_ids: [grupoOrigenId],
      })

      expect(result.invitaciones_creadas).toBe(1)
      expect(result.omitidos_ya_miembros).toBe(1)
      expect(result.grupos_origen[0]).toEqual({
        id: grupoOrigenId,
        nombre: 'Club Bici',
        invitaciones_creadas: 1,
      })
      expect(grupoInvitacionUpsert).toHaveBeenCalledTimes(1)
      expect(grupoInvitacionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: terceroId },
          },
          create: {
            grupo_id: grupoId,
            usuario_id: terceroId,
            invitado_por_id: creadorId,
            grupo_origen_id: grupoOrigenId,
            estado: 'pendiente',
          },
        })
      )
    })

    it('rechaza invitar desde el mismo grupo destino', async () => {
      const { prisma, grupoFindUnique, viajeFindFirst } = createBulkInviteMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue(null)

      const service = new GruposService(prisma)

      await expect(
        service.invitarDesdeGrupos(creadorId, grupoId, { grupo_origen_ids: [grupoId] })
      ).rejects.toMatchObject({
        status: 400,
        code: 'SAME_GROUP_ORIGIN',
      })
    })

    it('rechaza si el actor no pertenece al grupo origen', async () => {
      const { prisma, grupoFindUnique, viajeFindFirst, grupoFindMany } = createBulkInviteMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      viajeFindFirst.mockResolvedValue(null)
      grupoFindMany.mockResolvedValue([
        {
          id: grupoOrigenId,
          nombre: 'Club Bici',
          lider_id: otroId,
          miembros: [],
        },
      ])

      const service = new GruposService(prisma)

      await expect(
        service.invitarDesdeGrupos(creadorId, grupoId, { grupo_origen_ids: [grupoOrigenId] })
      ).rejects.toMatchObject({
        status: 403,
        code: 'NOT_SOURCE_GROUP_MEMBER',
      })
    })

    it('participante no puede invitar', async () => {
      const { prisma, grupoFindUnique } = createBulkInviteMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })

      const service = new GruposService(prisma)

      await expect(
        service.invitarDesdeGrupos(otroId, grupoId, { grupo_origen_ids: [grupoOrigenId] })
      ).rejects.toMatchObject({
        status: 403,
        code: 'NOT_GROUP_LEADER',
      })
    })
  })

  describe('listarUsuariosParaInvitar', () => {
    function createUsuariosInvitarMocks() {
      const grupoFindUnique = vi.fn().mockResolvedValue({ lider_id: creadorId })
      const viajeFindFirst = vi.fn().mockResolvedValue(null)
      const grupoFindMany = vi.fn().mockResolvedValue([
        { id: grupoOrigenId, nombre: 'Club Bici' },
      ])
      const grupoMiembroFindMany = vi.fn().mockImplementation((args: { where: { grupo_id?: string | { in: string[] } } }) => {
        if (args.where.grupo_id === grupoId) {
          return Promise.resolve([
            { usuario_id: creadorId },
            { usuario_id: otroId },
          ])
        }
        return Promise.resolve([
          {
            grupo_id: grupoOrigenId,
            usuario: { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
          },
        ])
      })
      const grupoInvitacionFindMany = vi.fn().mockResolvedValue([])

      const prisma = {
        grupo: { findUnique: grupoFindUnique, findMany: grupoFindMany },
        viaje: { findFirst: viajeFindFirst },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        grupoInvitacion: { findMany: grupoInvitacionFindMany },
      }

      return { prisma: prisma as unknown as PrismaClient, grupoInvitacionFindMany }
    }

    it('devuelve personas de otros grupos excluyendo miembros actuales', async () => {
      const { prisma } = createUsuariosInvitarMocks()
      const service = new GruposService(prisma)
      const result = await service.listarUsuariosParaInvitar(creadorId, grupoId)

      expect(result).toEqual([
        {
          id: terceroId,
          nombre: 'Carlos',
          email: 'carlos@test.com',
          grupos_origen: [{ id: grupoOrigenId, nombre: 'Club Bici' }],
        },
      ])
    })
  })

  describe('invitarUsuarios', () => {
    it('crea invitaciones para usuarios seleccionados', async () => {
      const grupoFindUnique = vi.fn().mockResolvedValue({ lider_id: creadorId })
      const viajeFindFirst = vi.fn().mockResolvedValue(null)
      const grupoFindMany = vi.fn().mockResolvedValue([
        { id: grupoOrigenId, nombre: 'Club Bici' },
      ])
      const grupoMiembroFindMany = vi.fn().mockImplementation((args: { where: { grupo_id?: string | { in: string[] } } }) => {
        if (args.where.grupo_id === grupoId) {
          return Promise.resolve([{ usuario_id: creadorId }])
        }
        return Promise.resolve([
          {
            grupo_id: grupoOrigenId,
            usuario: { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
          },
        ])
      })
      const grupoInvitacionUpsert = vi.fn().mockResolvedValue({})

      const usuarioFindMany = vi.fn().mockResolvedValue([
        { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
      ])

      const prisma = {
        grupo: { findUnique: grupoFindUnique, findMany: grupoFindMany },
        viaje: { findFirst: viajeFindFirst },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        usuario: { findMany: usuarioFindMany },
        amistad: { findMany: vi.fn().mockResolvedValue([]) },
        grupoInvitacion: {
          findMany: vi.fn().mockResolvedValue([]),
          upsert: grupoInvitacionUpsert,
        },
        $transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) =>
          fn({ grupoInvitacion: { upsert: grupoInvitacionUpsert } })
        ),
      } as unknown as PrismaClient

      const service = new GruposService(prisma)
      const result = await service.invitarUsuarios(creadorId, grupoId, {
        usuario_ids: [terceroId],
      })

      expect(result.invitaciones_creadas).toBe(1)
      expect(result.invitados[0]?.nombre).toBe('Carlos')
      expect(grupoInvitacionUpsert).toHaveBeenCalledWith({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: terceroId },
        },
        create: {
          grupo_id: grupoId,
          usuario_id: terceroId,
          invitado_por_id: creadorId,
          grupo_origen_id: grupoOrigenId,
          estado: 'pendiente',
        },
        update: expect.objectContaining({
          invitado_por_id: creadorId,
          grupo_origen_id: grupoOrigenId,
          estado: 'pendiente',
        }),
      })
    })
  })

  describe('listarAmigosParaInvitar', () => {
    it('devuelve amigos con flag ya_es_miembro', async () => {
      const grupoFindUnique = vi.fn().mockResolvedValue({ lider_id: creadorId })
      const amistadFindMany = vi.fn().mockResolvedValue([
        {
          solicitante_id: creadorId,
          destinatario_id: terceroId,
          solicitante: { id: creadorId, nombre: 'Ana', email: 'a@test.com' },
          destinatario: { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
        },
      ])
      const grupoMiembroFindMany = vi.fn().mockResolvedValue([{ usuario_id: creadorId }])
      const grupoInvitacionFindMany = vi.fn().mockResolvedValue([])

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        amistad: { findMany: amistadFindMany },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        grupoInvitacion: { findMany: grupoInvitacionFindMany },
      } as unknown as PrismaClient

      const service = new GruposService(prisma)
      const result = await service.listarAmigosParaInvitar(creadorId, grupoId)

      expect(result).toEqual([
        {
          id: terceroId,
          nombre: 'Carlos',
          email: 'carlos@test.com',
          ya_es_miembro: false,
          invitacion_pendiente: false,
        },
      ])
    })
  })

  describe('buscarUsuariosParaInvitar', () => {
    it('busca usuarios por nombre excluyendo al actor', async () => {
      const grupoFindUnique = vi.fn().mockResolvedValue({ lider_id: creadorId })
      const usuarioFindMany = vi.fn().mockResolvedValue([
        { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
      ])
      const grupoMiembroFindMany = vi.fn().mockResolvedValue([{ usuario_id: creadorId }])
      const grupoInvitacionFindMany = vi.fn().mockResolvedValue([])

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        usuario: { findMany: usuarioFindMany },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        grupoInvitacion: { findMany: grupoInvitacionFindMany },
      } as unknown as PrismaClient

      const service = new GruposService(prisma)
      const result = await service.buscarUsuariosParaInvitar(creadorId, grupoId, 'car')

      expect(result[0]?.nombre).toBe('Carlos')
      expect(usuarioFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: creadorId } }),
        })
      )
    })
  })

  describe('invitarUsuarios global', () => {
    it('invita usuario global con grupo_origen_id null', async () => {
      const grupoFindUnique = vi.fn().mockResolvedValue({ lider_id: creadorId })
      const grupoFindMany = vi.fn().mockResolvedValue([])
      const grupoMiembroFindMany = vi.fn().mockResolvedValue([{ usuario_id: creadorId }])
      const usuarioFindMany = vi.fn().mockResolvedValue([
        { id: terceroId, nombre: 'Carlos', email: 'carlos@test.com' },
      ])
      const grupoInvitacionUpsert = vi.fn().mockResolvedValue({})

      const prisma = {
        grupo: { findUnique: grupoFindUnique, findMany: grupoFindMany },
        grupoMiembro: { findMany: grupoMiembroFindMany },
        usuario: { findMany: usuarioFindMany },
        amistad: { findMany: vi.fn().mockResolvedValue([]) },
        grupoInvitacion: {
          findMany: vi.fn().mockResolvedValue([]),
          upsert: grupoInvitacionUpsert,
        },
        $transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) =>
          fn({ grupoInvitacion: { upsert: grupoInvitacionUpsert } })
        ),
      } as unknown as PrismaClient

      const service = new GruposService(prisma)
      await service.invitarUsuarios(creadorId, grupoId, { usuario_ids: [terceroId] })

      expect(grupoInvitacionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: terceroId },
          },
          create: {
            grupo_id: grupoId,
            usuario_id: terceroId,
            invitado_por_id: creadorId,
            grupo_origen_id: null,
            estado: 'pendiente',
          },
        })
      )
    })
  })

  describe('listarInvitacionesPendientes', () => {
    it('devuelve invitaciones pendientes del usuario', async () => {
      const fecha = new Date('2026-06-05T12:00:00Z')
      const invitacionId = '66666666-6666-6666-6666-666666666666'

      const prisma = {
        grupoInvitacion: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: invitacionId,
              created_at: fecha,
              grupo: { id: grupoId, nombre: 'Trail Riders' },
              grupo_origen: { id: grupoOrigenId, nombre: 'Club Bici' },
              invitado_por: { id: creadorId, nombre: 'Ana' },
            },
          ]),
        },
      } as unknown as PrismaClient

      const service = new GruposService(prisma)
      const result = await service.listarInvitacionesPendientes(otroId)

      expect(result).toHaveLength(1)
      expect(result[0]?.grupo.nombre).toBe('Trail Riders')
      expect(prisma.grupoInvitacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuario_id: otroId, estado: 'pendiente' },
        })
      )
    })
  })

  describe('responderInvitacion', () => {
    const invitacionId = '66666666-6666-6666-6666-666666666666'

    function createResponderMocks() {
      const grupoInvitacionFindUnique = vi.fn()
      const grupoInvitacionUpdate = vi.fn()
      const grupoMiembroFindUnique = vi.fn()
      const grupoMiembroCreate = vi.fn()

      const tx = {
        grupoInvitacion: { update: grupoInvitacionUpdate },
        grupoMiembro: { findUnique: grupoMiembroFindUnique, create: grupoMiembroCreate },
      }

      const prisma = {
        grupoInvitacion: {
          findUnique: grupoInvitacionFindUnique,
          update: grupoInvitacionUpdate,
        },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoInvitacionFindUnique,
        grupoInvitacionUpdate,
        grupoMiembroFindUnique,
        grupoMiembroCreate,
      }
    }

    it('acepta invitación y agrega al grupo como participante', async () => {
      const {
        prisma,
        grupoInvitacionFindUnique,
        grupoInvitacionUpdate,
        grupoMiembroFindUnique,
        grupoMiembroCreate,
      } = createResponderMocks()

      grupoInvitacionFindUnique.mockResolvedValue({
        id: invitacionId,
        usuario_id: otroId,
        grupo_id: grupoId,
        estado: 'pendiente',
        grupo: { nombre: 'Trail Riders' },
      })
      grupoInvitacionUpdate.mockResolvedValue({})
      grupoMiembroFindUnique.mockResolvedValue(null)
      grupoMiembroCreate.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.responderInvitacion(otroId, invitacionId, {
        accion: 'aceptar',
      })

      expect(result).toMatchObject({
        invitacion_id: invitacionId,
        grupo_id: grupoId,
        accion: 'aceptada',
        ya_era_miembro: false,
      })
      expect(grupoMiembroCreate).toHaveBeenCalledWith({
        data: { grupo_id: grupoId, usuario_id: otroId, rol: 'participante' },
      })
    })

    it('rechaza invitación sin agregar al grupo', async () => {
      const { prisma, grupoInvitacionFindUnique, grupoInvitacionUpdate } = createResponderMocks()

      grupoInvitacionFindUnique.mockResolvedValue({
        id: invitacionId,
        usuario_id: otroId,
        grupo_id: grupoId,
        estado: 'pendiente',
        grupo: { nombre: 'Trail Riders' },
      })
      grupoInvitacionUpdate.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.responderInvitacion(otroId, invitacionId, {
        accion: 'rechazar',
      })

      expect(result).toMatchObject({
        invitacion_id: invitacionId,
        accion: 'rechazada',
      })
      expect(grupoInvitacionUpdate).toHaveBeenCalledWith({
        where: { id: invitacionId },
        data: { estado: 'rechazada' },
      })
    })

    it('lanza 404 si la invitación no pertenece al usuario', async () => {
      const { prisma, grupoInvitacionFindUnique } = createResponderMocks()

      grupoInvitacionFindUnique.mockResolvedValue({
        id: invitacionId,
        usuario_id: creadorId,
        grupo_id: grupoId,
        estado: 'pendiente',
        grupo: { nombre: 'Trail Riders' },
      })

      const service = new GruposService(prisma)

      await expect(
        service.responderInvitacion(otroId, invitacionId, { accion: 'aceptar' })
      ).rejects.toMatchObject({
        status: 404,
        code: 'INVITATION_NOT_FOUND',
      })
    })

    it('lanza 409 si la invitación ya fue respondida', async () => {
      const { prisma, grupoInvitacionFindUnique } = createResponderMocks()

      grupoInvitacionFindUnique.mockResolvedValue({
        id: invitacionId,
        usuario_id: otroId,
        grupo_id: grupoId,
        estado: 'aceptada',
        grupo: { nombre: 'Trail Riders' },
      })

      const service = new GruposService(prisma)

      await expect(
        service.responderInvitacion(otroId, invitacionId, { accion: 'aceptar' })
      ).rejects.toMatchObject({
        status: 409,
        code: 'INVITATION_ALREADY_RESPONDED',
      })
    })
  })

  describe('eliminarGrupo', () => {
    function createEliminarMocks() {
      const grupoFindUnique = vi.fn()
      const grupoDelete = vi.fn()

      const tx = {
        grupo: { delete: grupoDelete },
      }

      const prisma = {
        grupo: { findUnique: grupoFindUnique },
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      }

      return {
        prisma: prisma as unknown as PrismaClient,
        grupoFindUnique,
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

    it('líder elimina el grupo', async () => {
      const { prisma, grupoFindUnique, grupoDelete } = createEliminarMocks()

      grupoFindUnique.mockResolvedValue({ lider_id: creadorId })
      grupoDelete.mockResolvedValue({})

      const service = new GruposService(prisma)
      const result = await service.eliminarGrupo(creadorId, grupoId)

      expect(result).toEqual({ accion: 'grupo_eliminado', grupo_id: grupoId })
      expect(grupoDelete).toHaveBeenCalledWith({ where: { id: grupoId } })
    })
  })
})
