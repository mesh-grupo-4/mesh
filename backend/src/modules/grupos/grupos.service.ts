import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { unirUsuarioAlGrupo } from './grupos.membership'
import type {
  AbandonarGrupoInput,
  CambiarRolMiembroInput,
  CreateGrupoInput,
  InvitarDesdeGruposInput,
  InvitarUsuariosInput,
  ResponderInvitacionInput,
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

  private async assertEsLider(actorId: string, grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { lider_id: true },
    })

    if (!grupo) {
      throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    }

    if (grupo.lider_id !== actorId) {
      throw new HttpError(403, 'Solo el líder puede invitar integrantes', 'NOT_GROUP_LEADER')
    }
  }

  private async eliminarGrupoInterno(tx: TransactionClient, grupoId: string) {
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

  private async obtenerOtrosGruposDelActor(actorId: string, grupoDestinoId: string) {
    return this.prisma.grupo.findMany({
      where: {
        id: { not: grupoDestinoId },
        OR: [
          { lider_id: actorId },
          { miembros: { some: { usuario_id: actorId } } },
        ],
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    })
  }

  private async obtenerExclusionesGrupo(grupoDestinoId: string) {
    const [miembrosDestino, invitacionesPendientes] = await Promise.all([
      this.prisma.grupoMiembro.findMany({
        where: { grupo_id: grupoDestinoId },
        select: { usuario_id: true },
      }),
      this.prisma.grupoInvitacion.findMany({
        where: { grupo_id: grupoDestinoId, estado: 'pendiente' },
        select: { usuario_id: true },
      }),
    ])

    const miembros = new Set(miembrosDestino.map((m) => m.usuario_id))
    const invitadosPendientes = new Set(invitacionesPendientes.map((i) => i.usuario_id))

    return { miembros, invitadosPendientes }
  }

  private mapUsuarioConMembresia(
    usuario: { id: string; nombre: string; email: string },
    exclusiones: { miembros: Set<string>; invitadosPendientes: Set<string> }
  ) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      ya_es_miembro: exclusiones.miembros.has(usuario.id),
      invitacion_pendiente: exclusiones.invitadosPendientes.has(usuario.id),
    }
  }

  async listarAmigosParaInvitar(actorId: string, grupoDestinoId: string) {
    await this.assertEsLider(actorId, grupoDestinoId)

    const amistades = await this.prisma.amistad.findMany({
      where: {
        estado: 'aceptada',
        OR: [{ solicitante_id: actorId }, { destinatario_id: actorId }],
      },
      select: {
        solicitante_id: true,
        destinatario_id: true,
        solicitante: { select: { id: true, nombre: true, email: true } },
        destinatario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    const exclusiones = await this.obtenerExclusionesGrupo(grupoDestinoId)

    return amistades
      .map((a) => (a.solicitante_id === actorId ? a.destinatario : a.solicitante))
      .map((u) => this.mapUsuarioConMembresia(u, exclusiones))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  async buscarUsuariosParaInvitar(actorId: string, grupoDestinoId: string, query: string) {
    await this.assertEsLider(actorId, grupoDestinoId)

    const exclusiones = await this.obtenerExclusionesGrupo(grupoDestinoId)

    const usuarios = await this.prisma.usuario.findMany({
      where: {
        id: { not: actorId },
        nombre: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: 'asc' },
      take: 20,
    })

    return usuarios.map((u) => this.mapUsuarioConMembresia(u, exclusiones))
  }

  private async validarInvitables(
    actorId: string,
    grupoDestinoId: string,
    usuarioIds: string[]
  ) {
    const exclusiones = await this.obtenerExclusionesGrupo(grupoDestinoId)
    const { candidatos: candidatosLegacy } = await this.construirCandidatosInvitacion(
      actorId,
      grupoDestinoId
    )

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, nombre: true, email: true },
    })
    const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]))

    const resultado = new Map<
      string,
      { id: string; nombre: string; grupo_origen_id: string | null }
    >()

    for (const usuarioId of usuarioIds) {
      if (usuarioId === actorId) {
        throw new HttpError(400, 'No podés invitarte a vos mismo', 'SELF_INVITE')
      }

      if (exclusiones.miembros.has(usuarioId) || exclusiones.invitadosPendientes.has(usuarioId)) {
        throw new HttpError(
          400,
          'Una o más personas ya pertenecen al grupo o tienen invitación pendiente',
          'ALREADY_MEMBER_OR_PENDING'
        )
      }

      const usuario = usuariosPorId.get(usuarioId)
      if (!usuario) {
        throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
      }

      const candidatoLegacy = candidatosLegacy.get(usuarioId)

      resultado.set(usuarioId, {
        id: usuario.id,
        nombre: usuario.nombre,
        grupo_origen_id: candidatoLegacy?.grupo_origen_id ?? null,
      })
    }

    return resultado
  }

  private async construirCandidatosInvitacion(actorId: string, grupoDestinoId: string) {
    const otrosGrupos = await this.obtenerOtrosGruposDelActor(actorId, grupoDestinoId)
    if (otrosGrupos.length === 0) {
      return { otrosGrupos, candidatos: new Map<string, {
        id: string
        nombre: string
        email: string
        grupos_origen: Array<{ id: string; nombre: string }>
        grupo_origen_id: string
      }>() }
    }

    const otrosGrupoIds = otrosGrupos.map((g) => g.id)
    const nombrePorGrupo = new Map(otrosGrupos.map((g) => [g.id, g.nombre]))

    const [miembrosDestino, invitacionesPendientes, miembrosOrigen] = await Promise.all([
      this.prisma.grupoMiembro.findMany({
        where: { grupo_id: grupoDestinoId },
        select: { usuario_id: true },
      }),
      this.prisma.grupoInvitacion.findMany({
        where: { grupo_id: grupoDestinoId, estado: 'pendiente' },
        select: { usuario_id: true },
      }),
      this.prisma.grupoMiembro.findMany({
        where: {
          grupo_id: { in: otrosGrupoIds },
          usuario_id: { not: actorId },
        },
        select: {
          grupo_id: true,
          usuario: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: { usuario: { nombre: 'asc' } },
      }),
    ])

    const excluidos = new Set([
      actorId,
      ...miembrosDestino.map((m) => m.usuario_id),
      ...invitacionesPendientes.map((i) => i.usuario_id),
    ])

    const candidatos = new Map<string, {
      id: string
      nombre: string
      email: string
      grupos_origen: Array<{ id: string; nombre: string }>
      grupo_origen_id: string
    }>()

    for (const m of miembrosOrigen) {
      if (excluidos.has(m.usuario.id)) continue

      const grupoRef = { id: m.grupo_id, nombre: nombrePorGrupo.get(m.grupo_id)! }
      const existente = candidatos.get(m.usuario.id)

      if (existente) {
        if (!existente.grupos_origen.some((g) => g.id === grupoRef.id)) {
          existente.grupos_origen.push(grupoRef)
        }
      } else {
        candidatos.set(m.usuario.id, {
          id: m.usuario.id,
          nombre: m.usuario.nombre,
          email: m.usuario.email,
          grupos_origen: [grupoRef],
          grupo_origen_id: m.grupo_id,
        })
      }
    }

    return { otrosGrupos, candidatos }
  }

  async listarUsuariosParaInvitar(actorId: string, grupoDestinoId: string) {
    await this.assertEsLider(actorId, grupoDestinoId)
    const { candidatos } = await this.construirCandidatosInvitacion(actorId, grupoDestinoId)

    return [...candidatos.values()]
      .map(({ id, nombre, email, grupos_origen }) => ({ id, nombre, email, grupos_origen }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  // Reactiva una invitación previa (aceptada/rechazada) o crea una nueva.
  // El @@unique(grupo_id, usuario_id) deja una sola fila por persona: si alguien
  // ya estuvo en el grupo y se fue, su fila quedó como 'aceptada' y un createMany
  // la saltaría, por eso la reabrimos como 'pendiente'.
  private async upsertInvitacionPendiente(
    tx: TransactionClient,
    params: {
      grupoDestinoId: string
      usuarioId: string
      invitadoPorId: string
      grupoOrigenId: string | null
    }
  ) {
    await tx.grupoInvitacion.upsert({
      where: {
        grupo_id_usuario_id: {
          grupo_id: params.grupoDestinoId,
          usuario_id: params.usuarioId,
        },
      },
      create: {
        grupo_id: params.grupoDestinoId,
        usuario_id: params.usuarioId,
        invitado_por_id: params.invitadoPorId,
        grupo_origen_id: params.grupoOrigenId,
        estado: 'pendiente',
      },
      update: {
        invitado_por_id: params.invitadoPorId,
        grupo_origen_id: params.grupoOrigenId,
        estado: 'pendiente',
        created_at: new Date(),
      },
    })
  }

  async invitarUsuarios(
    actorId: string,
    grupoDestinoId: string,
    input: InvitarUsuariosInput
  ) {
    await this.assertEsLider(actorId, grupoDestinoId)
    const { usuario_ids: usuarioIds } = input
    const idsUnicos = [...new Set(usuarioIds)]

    const invitables = await this.validarInvitables(actorId, grupoDestinoId, idsUnicos)

    // validarInvitables ya descartó miembros e invitaciones pendientes, así que
    // cada id es una invitación legítima (nueva o reactivada).
    await this.prisma.$transaction(async (tx) => {
      for (const usuarioId of idsUnicos) {
        const invitable = invitables.get(usuarioId)!
        await this.upsertInvitacionPendiente(tx, {
          grupoDestinoId,
          usuarioId,
          invitadoPorId: actorId,
          grupoOrigenId: invitable.grupo_origen_id,
        })
      }
    })

    const invitados = idsUnicos
      .map((id) => invitables.get(id)!)
      .map((c) => ({ id: c.id, nombre: c.nombre }))

    return {
      invitaciones_creadas: idsUnicos.length,
      invitados,
    }
  }

  async listarGruposParaInvitar(actorId: string, grupoDestinoId: string) {
    await this.assertEsLider(actorId, grupoDestinoId)
    const grupos = await this.prisma.grupo.findMany({
      where: {
        id: { not: grupoDestinoId },
        OR: [
          { lider_id: actorId },
          { miembros: { some: { usuario_id: actorId } } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        _count: { select: { miembros: true } },
      },
      orderBy: { nombre: 'asc' },
    })

    return grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      cantidad_integrantes: g._count.miembros,
    }))
  }

  async invitarDesdeGrupos(
    actorId: string,
    grupoDestinoId: string,
    input: InvitarDesdeGruposInput
  ) {
    await this.assertEsLider(actorId, grupoDestinoId)
    const { grupo_origen_ids: grupoOrigenIds } = input

    if (grupoOrigenIds.includes(grupoDestinoId)) {
      throw new HttpError(
        400,
        'No podés invitar desde el mismo grupo destino',
        'SAME_GROUP_ORIGIN'
      )
    }

    const gruposOrigen = await this.prisma.grupo.findMany({
      where: { id: { in: grupoOrigenIds } },
      select: {
        id: true,
        nombre: true,
        miembros: { where: { usuario_id: actorId }, select: { usuario_id: true } },
        lider_id: true,
      },
    })

    if (gruposOrigen.length !== grupoOrigenIds.length) {
      throw new HttpError(404, 'Uno o más grupos origen no existen', 'GRUPO_ORIGEN_NOT_FOUND')
    }

    for (const grupo of gruposOrigen) {
      const esMiembro =
        grupo.lider_id === actorId || grupo.miembros.length > 0
      if (!esMiembro) {
        throw new HttpError(
          403,
          'No tenés acceso a uno de los grupos seleccionados',
          'NOT_SOURCE_GROUP_MEMBER'
        )
      }
    }

    const miembrosDestino = await this.prisma.grupoMiembro.findMany({
      where: { grupo_id: grupoDestinoId },
      select: { usuario_id: true },
    })
    const idsMiembrosDestino = new Set(miembrosDestino.map((m) => m.usuario_id))

    // Quienes ya tienen una invitación pendiente no se recrean (ya están invitados).
    // Las invitaciones en otros estados (rechazada/aceptada de una membresía pasada)
    // sí se reabren vía upsert.
    const invitacionesPendientes = await this.prisma.grupoInvitacion.findMany({
      where: { grupo_id: grupoDestinoId, estado: 'pendiente' },
      select: { usuario_id: true },
    })
    const idsYaPendientes = new Set(invitacionesPendientes.map((i) => i.usuario_id))

    let totalCreadas = 0
    let totalOmitidosYaMiembros = 0
    const procesados = new Set<string>()
    const gruposOrigenResult: Array<{
      id: string
      nombre: string
      invitaciones_creadas: number
    }> = []

    await this.prisma.$transaction(async (tx) => {
      for (const grupoOrigen of gruposOrigen) {
        const miembrosOrigen = await tx.grupoMiembro.findMany({
          where: {
            grupo_id: grupoOrigen.id,
            usuario_id: { not: actorId },
          },
          select: { usuario_id: true },
        })

        totalOmitidosYaMiembros += miembrosOrigen.filter((m) =>
          idsMiembrosDestino.has(m.usuario_id)
        ).length

        const aInvitar = miembrosOrigen.filter(
          (m) =>
            !idsMiembrosDestino.has(m.usuario_id) &&
            !idsYaPendientes.has(m.usuario_id) &&
            !procesados.has(m.usuario_id)
        )

        if (aInvitar.length === 0) {
          gruposOrigenResult.push({
            id: grupoOrigen.id,
            nombre: grupoOrigen.nombre,
            invitaciones_creadas: 0,
          })
          continue
        }

        for (const m of aInvitar) {
          await this.upsertInvitacionPendiente(tx, {
            grupoDestinoId,
            usuarioId: m.usuario_id,
            invitadoPorId: actorId,
            grupoOrigenId: grupoOrigen.id,
          })
          procesados.add(m.usuario_id)
        }

        totalCreadas += aInvitar.length
        gruposOrigenResult.push({
          id: grupoOrigen.id,
          nombre: grupoOrigen.nombre,
          invitaciones_creadas: aInvitar.length,
        })
      }
    })

    return {
      invitaciones_creadas: totalCreadas,
      omitidos_ya_miembros: totalOmitidosYaMiembros,
      grupos_origen: gruposOrigenResult,
    }
  }

  async listarInvitacionesPendientes(usuarioId: string) {
    const invitaciones = await this.prisma.grupoInvitacion.findMany({
      where: {
        usuario_id: usuarioId,
        estado: 'pendiente',
      },
      select: {
        id: true,
        created_at: true,
        grupo: { select: { id: true, nombre: true } },
        grupo_origen: { select: { id: true, nombre: true } },
        invitado_por: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return invitaciones.map((inv) => ({
      id: inv.id,
      created_at: inv.created_at,
      grupo: inv.grupo,
      grupo_origen: inv.grupo_origen,
      invitado_por: inv.invitado_por,
    }))
  }

  async responderInvitacion(
    usuarioId: string,
    invitacionId: string,
    input: ResponderInvitacionInput
  ) {
    const invitacion = await this.prisma.grupoInvitacion.findUnique({
      where: { id: invitacionId },
      select: {
        id: true,
        usuario_id: true,
        grupo_id: true,
        estado: true,
        grupo: { select: { nombre: true } },
      },
    })

    if (!invitacion || invitacion.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Invitación no encontrada', 'INVITATION_NOT_FOUND')
    }

    if (invitacion.estado !== 'pendiente') {
      throw new HttpError(
        409,
        'Esta invitación ya fue respondida',
        'INVITATION_ALREADY_RESPONDED'
      )
    }

    const { accion } = input

    if (accion === 'rechazar') {
      await this.prisma.grupoInvitacion.update({
        where: { id: invitacionId },
        data: { estado: 'rechazada' },
      })

      return {
        invitacion_id: invitacionId,
        grupo_id: invitacion.grupo_id,
        grupo_nombre: invitacion.grupo.nombre,
        accion: 'rechazada' as const,
      }
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.grupoInvitacion.update({
        where: { id: invitacionId },
        data: { estado: 'aceptada' },
      })

      const union = await unirUsuarioAlGrupo(tx, usuarioId, invitacion.grupo_id)
      return union
    })

    return {
      invitacion_id: invitacionId,
      grupo_id: invitacion.grupo_id,
      grupo_nombre: invitacion.grupo.nombre,
      accion: 'aceptada' as const,
      ya_era_miembro: resultado.yaEraMiembro,
    }
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

    await this.prisma.$transaction(async (tx) => {
      await this.eliminarGrupoInterno(tx, grupoId)
    })

    return { accion: 'grupo_eliminado', grupo_id: grupoId }
  }
}
