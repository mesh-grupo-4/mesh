import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import type {
  AbandonarGrupoInput,
  CambiarRolMiembroInput,
  CreateGrupoInput,
} from './grupos.schemas'

type GrupoMutationResult = {
  accion: 'abandonado' | 'grupo_eliminado'
  grupo_id?: string
}

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

const grupoSelect = {
  id: true,
  nombre: true,
  fecha_creacion: true,
  lider_id: true,
} as const

async function transferirLiderazgo(
  tx: TransactionClient,
  grupoId: string,
  nuevoLiderId: string,
  exLiderId: string
) {
  await tx.grupo.update({
    where: { id: grupoId },
    data: { lider_id: nuevoLiderId },
  })
  await tx.grupoMiembro.update({
    where: {
      grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: nuevoLiderId },
    },
    data: { rol: 'lider' },
  })
  await tx.grupoMiembro.update({
    where: {
      grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: exLiderId },
    },
    data: { rol: 'participante' },
  })
}

export class GruposService {
  constructor(private readonly prisma: PrismaClient) {}

  private async assertNoViajeEnCurso(grupoId: string) {
    const viajeActivo = await this.prisma.viaje.findFirst({
      where: { grupo_id: grupoId, estado: 'en_curso' },
      select: { id: true },
    })

    if (viajeActivo) {
      throw new HttpError(
        409,
        'No se puede modificar el grupo mientras hay un viaje en curso',
        'TRIP_IN_PROGRESS'
      )
    }
  }

  private async eliminarGrupoInterno(tx: TransactionClient, grupoId: string) {
    await tx.viaje.deleteMany({
      where: { grupo_id: grupoId, estado: 'planificado' },
    })
    await tx.grupo.delete({ where: { id: grupoId } })
  }

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

  async listarMiembros(usuarioId: string, grupoId: string) {
    await this.detalleParaMiembro(usuarioId, grupoId)

    const miembros = await this.prisma.grupoMiembro.findMany({
      where: { grupo_id: grupoId },
      select: {
        rol: true,
        fecha_union: true,
        usuario: {
          select: { id: true, nombre: true, email: true },
        },
      },
      orderBy: { fecha_union: 'asc' },
    })

    return miembros.map((m) => ({
      id: m.usuario.id,
      nombre: m.usuario.nombre,
      email: m.usuario.email,
      rol: m.rol,
      fecha_union: m.fecha_union,
    }))
  }

  async cambiarRolMiembro(
    actorId: string,
    grupoId: string,
    usuarioId: string,
    input: CambiarRolMiembroInput
  ) {
    if (actorId === usuarioId) {
      throw new HttpError(400, 'No podés cambiar tu propio rol', 'CANNOT_CHANGE_OWN_ROLE')
    }

    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { lider_id: true },
    })

    if (!grupo) {
      throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    }

    if (grupo.lider_id !== actorId) {
      throw new HttpError(403, 'Solo el líder puede cambiar roles', 'NOT_GROUP_LEADER')
    }

    const miembroTarget = await this.prisma.grupoMiembro.findUnique({
      where: {
        grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId },
      },
      select: { rol: true },
    })

    if (!miembroTarget) {
      throw new HttpError(404, 'Integrante no encontrado en el grupo', 'MEMBER_NOT_FOUND')
    }

    const { rol: nuevoRol } = input

    if (nuevoRol === 'participante' && grupo.lider_id === usuarioId) {
      throw new HttpError(
        400,
        'No podés degradar al líder actual. Transferí el liderazgo a otro integrante.',
        'CANNOT_DEMOTE_LEADER'
      )
    }

    if (nuevoRol === miembroTarget.rol) {
      return { usuario_id: usuarioId, rol: nuevoRol }
    }

    if (nuevoRol === 'lider') {
      return this.prisma.$transaction(async (tx) => {
        await transferirLiderazgo(tx, grupoId, usuarioId, actorId)
        return { usuario_id: usuarioId, rol: 'lider' as const }
      })
    }

    await this.prisma.grupoMiembro.update({
      where: {
        grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId },
      },
      data: { rol: 'participante' },
    })

    return { usuario_id: usuarioId, rol: 'participante' as const }
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

  async abandonarGrupo(
    usuarioId: string,
    grupoId: string,
    input: AbandonarGrupoInput = {}
  ): Promise<GrupoMutationResult> {
    const detalle = await this.detalleParaMiembro(usuarioId, grupoId)

    if (detalle.mi_rol === 'participante') {
      await this.prisma.grupoMiembro.delete({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId },
        },
      })
      return { accion: 'abandonado' }
    }

    await this.assertNoViajeEnCurso(grupoId)

    const otrosMiembros = await this.prisma.grupoMiembro.count({
      where: {
        grupo_id: grupoId,
        usuario_id: { not: usuarioId },
      },
    })

    if (otrosMiembros === 0) {
      await this.prisma.$transaction(async (tx) => {
        await this.eliminarGrupoInterno(tx, grupoId)
      })
      return { accion: 'grupo_eliminado', grupo_id: grupoId }
    }

    const { nuevo_lider_id: nuevoLiderId } = input
    if (!nuevoLiderId) {
      throw new HttpError(
        400,
        'Debés seleccionar un nuevo líder para abandonar el grupo',
        'LEADER_MUST_TRANSFER'
      )
    }

    if (nuevoLiderId === usuarioId) {
      throw new HttpError(400, 'No podés transferirte el liderazgo a vos mismo', 'INVALID_LEADER')
    }

    const miembroTarget = await this.prisma.grupoMiembro.findUnique({
      where: {
        grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: nuevoLiderId },
      },
      select: { rol: true },
    })

    if (!miembroTarget) {
      throw new HttpError(404, 'Integrante no encontrado en el grupo', 'MEMBER_NOT_FOUND')
    }

    await this.prisma.$transaction(async (tx) => {
      await transferirLiderazgo(tx, grupoId, nuevoLiderId, usuarioId)
      await tx.grupoMiembro.delete({
        where: {
          grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId },
        },
      })
    })

    return { accion: 'abandonado' }
  }

  async eliminarGrupo(usuarioId: string, grupoId: string): Promise<GrupoMutationResult> {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { lider_id: true },
    })

    if (!grupo) {
      throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    }

    if (grupo.lider_id !== usuarioId) {
      throw new HttpError(403, 'Solo el líder puede eliminar el grupo', 'NOT_GROUP_LEADER')
    }

    await this.assertNoViajeEnCurso(grupoId)

    await this.prisma.$transaction(async (tx) => {
      await this.eliminarGrupoInterno(tx, grupoId)
    })

    return { accion: 'grupo_eliminado', grupo_id: grupoId }
  }
}
