import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import type {
  ResponderSolicitudAmistadInput,
  SolicitarAmistadInput,
} from './amistades.schemas'

export type RelacionAmistad = 'amigo' | 'solicitud_enviada' | 'solicitud_recibida' | null

export class AmistadesService {
  constructor(private readonly prisma: PrismaClient) {}

  async listarAmigos(usuarioId: string) {
    const amistades = await this.prisma.amistad.findMany({
      where: {
        estado: 'aceptada',
        OR: [{ solicitante_id: usuarioId }, { destinatario_id: usuarioId }],
      },
      select: {
        solicitante_id: true,
        destinatario_id: true,
        solicitante: { select: { id: true, nombre: true, email: true } },
        destinatario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return amistades
      .map((a) => (a.solicitante_id === usuarioId ? a.destinatario : a.solicitante))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  async listarSolicitudesPendientes(usuarioId: string) {
    const solicitudes = await this.prisma.amistad.findMany({
      where: {
        destinatario_id: usuarioId,
        estado: 'pendiente',
      },
      select: {
        id: true,
        created_at: true,
        solicitante: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return solicitudes.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      solicitante: s.solicitante,
    }))
  }

  async solicitarAmistad(solicitanteId: string, input: SolicitarAmistadInput) {
    const { usuario_id: destinatarioId } = input

    if (solicitanteId === destinatarioId) {
      throw new HttpError(400, 'No podés enviarte una solicitud a vos mismo', 'SELF_FRIEND_REQUEST')
    }

    const destinatario = await this.prisma.usuario.findUnique({
      where: { id: destinatarioId },
      select: { id: true },
    })

    if (!destinatario) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    const existente = await this.prisma.amistad.findFirst({
      where: {
        OR: [
          { solicitante_id: solicitanteId, destinatario_id: destinatarioId },
          { solicitante_id: destinatarioId, destinatario_id: solicitanteId },
        ],
      },
      select: { id: true, estado: true, solicitante_id: true },
    })

    if (existente) {
      if (existente.estado === 'aceptada') {
        throw new HttpError(409, 'Ya son amigos', 'ALREADY_FRIENDS')
      }
      if (existente.estado === 'pendiente') {
        if (existente.solicitante_id === solicitanteId) {
          throw new HttpError(409, 'Ya enviaste una solicitud a esta persona', 'REQUEST_ALREADY_SENT')
        }
        throw new HttpError(409, 'Esta persona ya te envió una solicitud', 'REQUEST_ALREADY_RECEIVED')
      }
    }

    const solicitud = await this.prisma.amistad.create({
      data: {
        solicitante_id: solicitanteId,
        destinatario_id: destinatarioId,
        estado: 'pendiente',
      },
      select: {
        id: true,
        created_at: true,
        destinatario: { select: { id: true, nombre: true } },
      },
    })

    return {
      id: solicitud.id,
      created_at: solicitud.created_at,
      destinatario: solicitud.destinatario,
    }
  }

  async responderSolicitud(
    usuarioId: string,
    solicitudId: string,
    input: ResponderSolicitudAmistadInput
  ) {
    const solicitud = await this.prisma.amistad.findUnique({
      where: { id: solicitudId },
      select: {
        id: true,
        destinatario_id: true,
        solicitante_id: true,
        estado: true,
        solicitante: { select: { nombre: true } },
      },
    })

    if (!solicitud || solicitud.destinatario_id !== usuarioId) {
      throw new HttpError(404, 'Solicitud no encontrada', 'FRIEND_REQUEST_NOT_FOUND')
    }

    if (solicitud.estado !== 'pendiente') {
      throw new HttpError(409, 'Esta solicitud ya fue respondida', 'REQUEST_ALREADY_RESPONDED')
    }

    const { accion } = input

    if (accion === 'aceptar') {
      await this.prisma.amistad.update({
        where: { id: solicitudId },
        data: { estado: 'aceptada' },
      })

      return {
        solicitud_id: solicitudId,
        accion: 'aceptada' as const,
        amigo_id: solicitud.solicitante_id,
        amigo_nombre: solicitud.solicitante.nombre,
      }
    }

    await this.prisma.amistad.delete({ where: { id: solicitudId } })

    return {
      solicitud_id: solicitudId,
      accion: 'rechazada' as const,
      amigo_id: solicitud.solicitante_id,
      amigo_nombre: solicitud.solicitante.nombre,
    }
  }

  async buscarUsuarios(usuarioId: string, query: string) {
    const [usuarios, amistades] = await Promise.all([
      this.prisma.usuario.findMany({
        where: {
          id: { not: usuarioId },
          OR: [
            { nombre: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, email: true },
        orderBy: { nombre: 'asc' },
        take: 20,
      }),
      this.prisma.amistad.findMany({
        where: {
          OR: [{ solicitante_id: usuarioId }, { destinatario_id: usuarioId }],
        },
        select: {
          solicitante_id: true,
          destinatario_id: true,
          estado: true,
        },
      }),
    ])

    const relaciones = new Map<string, RelacionAmistad>()
    for (const a of amistades) {
      const otroId =
        a.solicitante_id === usuarioId ? a.destinatario_id : a.solicitante_id

      if (a.estado === 'aceptada') {
        relaciones.set(otroId, 'amigo')
      } else if (a.estado === 'pendiente') {
        relaciones.set(
          otroId,
          a.solicitante_id === usuarioId ? 'solicitud_enviada' : 'solicitud_recibida'
        )
      }
    }

    return usuarios.map((u) => ({
      ...u,
      relacion: relaciones.get(u.id) ?? null,
    }))
  }

  async eliminarAmigo(usuarioId: string, amigoId: string) {
    if (usuarioId === amigoId) {
      throw new HttpError(400, 'No podés eliminarte a vos mismo', 'SELF_UNFRIEND')
    }

    const amistad = await this.prisma.amistad.findFirst({
      where: {
        estado: 'aceptada',
        OR: [
          { solicitante_id: usuarioId, destinatario_id: amigoId },
          { solicitante_id: amigoId, destinatario_id: usuarioId },
        ],
      },
      select: { id: true },
    })

    if (!amistad) {
      throw new HttpError(404, 'No tenés una amistad con esta persona', 'FRIENDSHIP_NOT_FOUND')
    }

    await this.prisma.amistad.delete({ where: { id: amistad.id } })

    return { amigo_id: amigoId }
  }

  async obtenerIdsAmigos(usuarioId: string): Promise<Set<string>> {
    const amistades = await this.prisma.amistad.findMany({
      where: {
        estado: 'aceptada',
        OR: [{ solicitante_id: usuarioId }, { destinatario_id: usuarioId }],
      },
      select: { solicitante_id: true, destinatario_id: true },
    })

    const ids = new Set<string>()
    for (const a of amistades) {
      ids.add(a.solicitante_id === usuarioId ? a.destinatario_id : a.solicitante_id)
    }
    return ids
  }

  async esAmigo(usuarioId: string, otroId: string): Promise<boolean> {
    const amistad = await this.prisma.amistad.findFirst({
      where: {
        estado: 'aceptada',
        OR: [
          { solicitante_id: usuarioId, destinatario_id: otroId },
          { solicitante_id: otroId, destinatario_id: usuarioId },
        ],
      },
      select: { id: true },
    })
    return amistad !== null
  }
}
