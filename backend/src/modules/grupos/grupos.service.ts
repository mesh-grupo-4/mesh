import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import type { CreateGrupoInput } from './grupos.schemas'

const grupoSelect = {
  id: true,
  nombre: true,
  fecha_creacion: true,
  lider_id: true,
} as const

export class GruposService {
  constructor(private readonly prisma: PrismaClient) {}

  async crearGrupo(creadorId: string, input: CreateGrupoInput) {
    const existe = await this.prisma.usuario.findUnique({ where: { id: creadorId } })
    if (!existe) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    return this.prisma.$transaction(async (tx) => {
      const grupo = await tx.grupo.create({
        data: {
          nombre: input.nombre,
          lider_id: creadorId,
        },
        select: grupoSelect,
      })

      await tx.grupoMiembro.create({
        data: {
          grupo_id: grupo.id,
          usuario_id: creadorId,
          rol: 'lider',
        },
      })

      return grupo
    })
  }

  async listarParaUsuario(usuarioId: string) {
    const grupos = await this.prisma.grupo.findMany({
      where: {
        OR: [
          { lider_id: usuarioId },
          { miembros: { some: { usuario_id: usuarioId } } },
        ],
      },
      select: {
        ...grupoSelect,
        miembros: {
          where: { usuario_id: usuarioId },
          select: { rol: true },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    })

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      fecha_creacion: g.fecha_creacion,
      lider_id: g.lider_id,
      mi_rol: (g.lider_id === usuarioId ? 'lider' : g.miembros[0]?.rol ?? 'participante') as
        | 'lider'
        | 'participante',
    }))
  }

  async detalleParaMiembro(usuarioId: string, grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: {
        ...grupoSelect,
        miembros: {
          where: { usuario_id: usuarioId },
          select: { rol: true },
        },
      },
    })

    if (!grupo) {
      throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    }

    const esMiembro = grupo.lider_id === usuarioId || grupo.miembros.length > 0
    if (!esMiembro) {
      throw new HttpError(403, 'No tenés acceso a este grupo', 'NOT_GROUP_MEMBER')
    }

    const rol = grupo.lider_id === usuarioId ? 'lider' : grupo.miembros[0]?.rol ?? 'participante'

    return {
      id: grupo.id,
      nombre: grupo.nombre,
      fecha_creacion: grupo.fecha_creacion,
      lider_id: grupo.lider_id,
      mi_rol: rol,
    }
  }

  async listarViajesPlanificados(usuarioId: string, grupoId: string) {
    await this.detalleParaMiembro(usuarioId, grupoId)

    const viajes = await this.prisma.viaje.findMany({
      where: {
        grupo_id: grupoId,
        es_grupal: true,
        estado: 'planificado',
      },
      select: {
        id: true,
        tipo_actividad: true,
        fecha_programada: true,
        estado: true,
      },
      orderBy: { fecha_programada: 'asc' },
    })

    return viajes
  }
}
