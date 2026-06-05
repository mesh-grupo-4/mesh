import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { AmistadesService } from './amistades.service'
import { HttpError } from '../../lib/httpError'

const usuarioA = '11111111-1111-1111-1111-111111111111'
const usuarioB = '22222222-2222-2222-2222-222222222222'
const solicitudId = '33333333-3333-3333-3333-333333333333'

describe('AmistadesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listarAmigos', () => {
    it('devuelve amigos aceptados del otro lado de la relación', async () => {
      const amistadFindMany = vi.fn().mockResolvedValue([
        {
          solicitante_id: usuarioA,
          destinatario_id: usuarioB,
          solicitante: { id: usuarioA, nombre: 'Ana', email: 'a@test.com' },
          destinatario: { id: usuarioB, nombre: 'Bruno', email: 'b@test.com' },
        },
      ])

      const prisma = { amistad: { findMany: amistadFindMany } } as unknown as PrismaClient
      const service = new AmistadesService(prisma)
      const result = await service.listarAmigos(usuarioA)

      expect(result).toEqual([{ id: usuarioB, nombre: 'Bruno', email: 'b@test.com' }])
    })
  })

  describe('solicitarAmistad', () => {
    it('crea solicitud pendiente', async () => {
      const usuarioFindUnique = vi.fn().mockResolvedValue({ id: usuarioB })
      const amistadFindFirst = vi.fn().mockResolvedValue(null)
      const amistadCreate = vi.fn().mockResolvedValue({
        id: solicitudId,
        created_at: new Date('2026-06-05T12:00:00Z'),
        destinatario: { id: usuarioB, nombre: 'Bruno' },
      })

      const prisma = {
        usuario: { findUnique: usuarioFindUnique },
        amistad: { findFirst: amistadFindFirst, create: amistadCreate },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)
      const result = await service.solicitarAmistad(usuarioA, { usuario_id: usuarioB })

      expect(result.id).toBe(solicitudId)
      expect(amistadCreate).toHaveBeenCalledWith({
        data: {
          solicitante_id: usuarioA,
          destinatario_id: usuarioB,
          estado: 'pendiente',
        },
        select: expect.any(Object),
      })
    })

    it('rechaza auto-solicitud', async () => {
      const prisma = {} as unknown as PrismaClient
      const service = new AmistadesService(prisma)

      await expect(
        service.solicitarAmistad(usuarioA, { usuario_id: usuarioA })
      ).rejects.toMatchObject({ status: 400, code: 'SELF_FRIEND_REQUEST' })
    })

    it('rechaza si ya son amigos', async () => {
      const usuarioFindUnique = vi.fn().mockResolvedValue({ id: usuarioB })
      const amistadFindFirst = vi.fn().mockResolvedValue({
        id: solicitudId,
        estado: 'aceptada',
        solicitante_id: usuarioA,
      })

      const prisma = {
        usuario: { findUnique: usuarioFindUnique },
        amistad: { findFirst: amistadFindFirst },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)

      await expect(
        service.solicitarAmistad(usuarioA, { usuario_id: usuarioB })
      ).rejects.toMatchObject({ status: 409, code: 'ALREADY_FRIENDS' })
    })
  })

  describe('responderSolicitud', () => {
    it('acepta solicitud pendiente', async () => {
      const amistadFindUnique = vi.fn().mockResolvedValue({
        id: solicitudId,
        destinatario_id: usuarioB,
        solicitante_id: usuarioA,
        estado: 'pendiente',
        solicitante: { nombre: 'Ana' },
      })
      const amistadUpdate = vi.fn().mockResolvedValue({})

      const prisma = {
        amistad: { findUnique: amistadFindUnique, update: amistadUpdate },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)
      const result = await service.responderSolicitud(usuarioB, solicitudId, { accion: 'aceptar' })

      expect(result).toEqual({
        solicitud_id: solicitudId,
        accion: 'aceptada',
        amigo_id: usuarioA,
        amigo_nombre: 'Ana',
      })
      expect(amistadUpdate).toHaveBeenCalledWith({
        where: { id: solicitudId },
        data: { estado: 'aceptada' },
      })
    })

    it('solo el destinatario puede responder', async () => {
      const amistadFindUnique = vi.fn().mockResolvedValue({
        id: solicitudId,
        destinatario_id: usuarioB,
        solicitante_id: usuarioA,
        estado: 'pendiente',
        solicitante: { nombre: 'Ana' },
      })

      const prisma = { amistad: { findUnique: amistadFindUnique } } as unknown as PrismaClient
      const service = new AmistadesService(prisma)

      await expect(
        service.responderSolicitud(usuarioA, solicitudId, { accion: 'aceptar' })
      ).rejects.toBeInstanceOf(HttpError)
    })

    it('rechazar elimina la solicitud', async () => {
      const amistadFindUnique = vi.fn().mockResolvedValue({
        id: solicitudId,
        destinatario_id: usuarioB,
        solicitante_id: usuarioA,
        estado: 'pendiente',
        solicitante: { nombre: 'Ana' },
      })
      const amistadDelete = vi.fn().mockResolvedValue({})

      const prisma = {
        amistad: { findUnique: amistadFindUnique, delete: amistadDelete },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)
      const result = await service.responderSolicitud(usuarioB, solicitudId, { accion: 'rechazar' })

      expect(result.accion).toBe('rechazada')
      expect(amistadDelete).toHaveBeenCalledWith({ where: { id: solicitudId } })
    })
  })

  describe('buscarUsuarios', () => {
    it('devuelve usuarios con estado de relación', async () => {
      const usuarioFindMany = vi.fn().mockResolvedValue([
        { id: usuarioB, nombre: 'Bruno', email: 'b@test.com' },
      ])
      const amistadFindMany = vi.fn().mockResolvedValue([
        {
          solicitante_id: usuarioA,
          destinatario_id: usuarioB,
          estado: 'pendiente',
        },
      ])

      const prisma = {
        usuario: { findMany: usuarioFindMany },
        amistad: { findMany: amistadFindMany },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)
      const result = await service.buscarUsuarios(usuarioA, 'bru')

      expect(result).toEqual([
        {
          id: usuarioB,
          nombre: 'Bruno',
          email: 'b@test.com',
          relacion: 'solicitud_enviada',
        },
      ])
    })
  })

  describe('eliminarAmigo', () => {
    it('elimina amistad aceptada', async () => {
      const amistadFindFirst = vi.fn().mockResolvedValue({ id: solicitudId })
      const amistadDelete = vi.fn().mockResolvedValue({})

      const prisma = {
        amistad: { findFirst: amistadFindFirst, delete: amistadDelete },
      } as unknown as PrismaClient

      const service = new AmistadesService(prisma)
      const result = await service.eliminarAmigo(usuarioA, usuarioB)

      expect(result).toEqual({ amigo_id: usuarioB })
      expect(amistadDelete).toHaveBeenCalledWith({ where: { id: solicitudId } })
    })

    it('falla si no hay amistad aceptada', async () => {
      const amistadFindFirst = vi.fn().mockResolvedValue(null)

      const prisma = { amistad: { findFirst: amistadFindFirst } } as unknown as PrismaClient
      const service = new AmistadesService(prisma)

      await expect(service.eliminarAmigo(usuarioA, usuarioB)).rejects.toMatchObject({
        status: 404,
        code: 'FRIENDSHIP_NOT_FOUND',
      })
    })
  })
})
