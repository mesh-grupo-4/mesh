import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { GruposService } from './grupos.service'
import { HttpError } from '../../lib/httpError'

const creadorId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
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
})
