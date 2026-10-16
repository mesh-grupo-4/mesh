import type { Prisma, PrismaClient, RolSistema } from '@prisma/client'
import { firebaseAuth } from '../../config/firebase'
import { HttpError } from '../../lib/httpError'
import { getIo } from '../../realtime/ioRegistry'
import { transferirLiderazgo, type TransactionClient } from '../grupos/grupos.service'
import { ViajesService } from '../viajes/viajes.service'
import type {
  ActualizarUsuarioAdminInput,
  ListarAuditoriaQuery,
  ListarGruposQuery,
  ListarUsuariosQuery,
  ListarViajesQuery,
} from './admin.schemas'

/** Acciones que quedan en `auditoria_admin` (RN-121). */
export type AccionAdmin =
  | 'usuario.editar'
  | 'usuario.cambiar_rol'
  | 'usuario.suspender'
  | 'usuario.reactivar'
  | 'usuario.eliminar'
  | 'grupo.reasignar_lider'
  | 'grupo.quitar_miembro'
  | 'grupo.eliminar'
  | 'viaje.finalizar'
  | 'viaje.eliminar'

type EntidadAdmin = 'usuario' | 'grupo' | 'viaje'

/**
 * Operaciones sobre la cuenta de Firebase. Se inyectan para poder testear el
 * servicio sin credenciales reales.
 */
export type CuentasFirebase = {
  deshabilitar(uid: string): Promise<void>
  habilitar(uid: string): Promise<void>
  eliminar(uid: string): Promise<void>
}

function esUsuarioFirebaseInexistente(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'auth/user-not-found'
  )
}

export const cuentasFirebase: CuentasFirebase = {
  async deshabilitar(uid) {
    await firebaseAuth.updateUser(uid, { disabled: true })
    await firebaseAuth.revokeRefreshTokens(uid)
  },
  async habilitar(uid) {
    await firebaseAuth.updateUser(uid, { disabled: false })
  },
  async eliminar(uid) {
    try {
      await firebaseAuth.deleteUser(uid)
    } catch (err) {
      // Reintento tras una eliminación a medias: la cuenta ya no existe y está bien.
      if (!esUsuarioFirebaseInexistente(err)) throw err
    }
  },
}

/** Corta las conexiones Socket.io abiertas de una persona (suspensión, RN-123). */
async function desconectarSockets(usuarioId: string): Promise<void> {
  const sockets = await getIo().fetchSockets()
  for (const s of sockets) {
    if (s.data.userId === usuarioId) s.disconnect(true)
  }
}

const usuarioResumenSelect = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  rol_sistema: true,
  suspendido_at: true,
  created_at: true,
} as const

const personaSelect = { id: true, nombre: true, apellido: true, email: true } as const

function paginar(pagina: number, limite: number) {
  return { skip: (pagina - 1) * limite, take: limite }
}

function filtroTexto(q: string | undefined, campos: string[]) {
  if (!q) return {}
  return {
    OR: campos.map((campo) => ({ [campo]: { contains: q, mode: 'insensitive' as const } })),
  }
}

/**
 * Backoffice de la plataforma (RN-120 a RN-126).
 *
 * El superadmin actúa a través de estos endpoints y no saltándose los chequeos de
 * los servicios de dominio: así cada acción queda auditada en un único lugar y las
 * reglas de privacidad (RN-110–114) no se debilitan por la puerta de atrás. Por eso
 * acá no hay ninguna lectura de posiciones GPS ni de ubicaciones vivas (RN-126).
 */
export class AdminService {
  private readonly viajes: ViajesService

  constructor(
    private readonly prisma: PrismaClient,
    private readonly firebase: CuentasFirebase = cuentasFirebase,
    viajes?: ViajesService
  ) {
    this.viajes = viajes ?? new ViajesService(prisma)
  }

  private async auditar(
    db: TransactionClient | PrismaClient,
    actorId: string,
    accion: AccionAdmin,
    entidad: EntidadAdmin,
    entidadId: string,
    detalle?: Prisma.InputJsonValue
  ) {
    await db.auditoriaAdmin.create({
      data: { actor_id: actorId, accion, entidad, entidad_id: entidadId, detalle },
    })
  }

  // ── Panel ────────────────────────────────────────────────────────────────

  async estadisticas() {
    const [usuarios, superadmins, suspendidos, grupos, porEstado] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.usuario.count({ where: { rol_sistema: 'superadmin' } }),
      this.prisma.usuario.count({ where: { suspendido_at: { not: null } } }),
      this.prisma.grupo.count(),
      this.prisma.viaje.groupBy({ by: ['estado'], _count: { _all: true } }),
    ])
    const viajes = { planificado: 0, en_curso: 0, finalizado: 0, total: 0 }
    for (const fila of porEstado) {
      viajes[fila.estado] = fila._count._all
      viajes.total += fila._count._all
    }
    return { usuarios: { total: usuarios, superadmins, suspendidos }, grupos: { total: grupos }, viajes }
  }

  // ── Usuarios ─────────────────────────────────────────────────────────────

  async listarUsuarios(query: ListarUsuariosQuery) {
    const where: Prisma.UsuarioWhereInput = {
      ...filtroTexto(query.q, ['nombre', 'apellido', 'email']),
      ...(query.rol ? { rol_sistema: query.rol } : {}),
      ...(query.estado === 'suspendido' ? { suspendido_at: { not: null } } : {}),
      ...(query.estado === 'activo' ? { suspendido_at: null } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        select: usuarioResumenSelect,
        orderBy: { created_at: 'desc' },
        ...paginar(query.pagina, query.limite),
      }),
      this.prisma.usuario.count({ where }),
    ])
    return { items, total, pagina: query.pagina, limite: query.limite }
  }

  async detalleUsuario(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        ...usuarioResumenSelect,
        telefono: true,
        actividad_preferida: true,
        motivo_suspension: true,
        membresias: {
          select: { rol: true, fecha_union: true, grupo: { select: { id: true, nombre: true } } },
          orderBy: { fecha_union: 'asc' },
        },
        _count: {
          select: { viajes_creados: true, participaciones_viaje: true, grupos_liderados: true },
        },
      },
    })
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')

    const { membresias, _count, ...datos } = usuario
    return {
      ...datos,
      grupos: membresias.map((m) => ({
        id: m.grupo.id,
        nombre: m.grupo.nombre,
        rol: m.rol,
        fecha_union: m.fecha_union,
      })),
      totales: {
        viajes_creados: _count.viajes_creados,
        participaciones_viaje: _count.participaciones_viaje,
        grupos_liderados: _count.grupos_liderados,
      },
    }
  }

  private async obtenerUsuarioOFallar(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        nombre: true,
        firebase_uid: true,
        rol_sistema: true,
        suspendido_at: true,
      },
    })
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    return usuario
  }

  async actualizarUsuario(actorId: string, usuarioId: string, input: ActualizarUsuarioAdminInput) {
    await this.obtenerUsuarioOFallar(usuarioId)
    return this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuarioId }, data: input })
      await this.auditar(tx, actorId, 'usuario.editar', 'usuario', usuarioId, {
        campos: Object.keys(input),
      })
      return tx.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { ...usuarioResumenSelect, telefono: true, actividad_preferida: true },
      })
    })
  }

  /**
   * RN-122: nadie cambia su propio rol. Como consecuencia siempre queda al menos un
   * superadmin (el que actúa), sin necesidad de contar cuántos hay.
   */
  async cambiarRolSistema(actorId: string, usuarioId: string, rol: RolSistema) {
    if (actorId === usuarioId) {
      throw new HttpError(400, 'No podés cambiar tu propio rol', 'CANNOT_CHANGE_OWN_ROLE')
    }
    const usuario = await this.obtenerUsuarioOFallar(usuarioId)
    if (usuario.rol_sistema === rol) {
      return { id: usuarioId, rol_sistema: rol }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuarioId }, data: { rol_sistema: rol } })
      await this.auditar(tx, actorId, 'usuario.cambiar_rol', 'usuario', usuarioId, {
        email: usuario.email,
        de: usuario.rol_sistema,
        a: rol,
      })
    })
    return { id: usuarioId, rol_sistema: rol }
  }

  /**
   * RN-123: la suspensión corta el acceso en el acto (REST y sockets) y deshabilita
   * la cuenta en Firebase para que no pueda volver a iniciar sesión. Lo de Firebase
   * es refuerzo: la fuente de verdad es `suspendido_at`, que `requireUser` mira en
   * cada request, así que si Firebase falla la suspensión igual rige.
   */
  async suspenderUsuario(actorId: string, usuarioId: string, motivo: string) {
    if (actorId === usuarioId) {
      throw new HttpError(400, 'No podés suspender tu propia cuenta', 'CANNOT_SUSPEND_SELF')
    }
    const usuario = await this.obtenerUsuarioOFallar(usuarioId)
    if (usuario.suspendido_at) {
      throw new HttpError(409, 'La cuenta ya está suspendida', 'ALREADY_SUSPENDED')
    }

    const suspendidoAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { suspendido_at: suspendidoAt, motivo_suspension: motivo },
      })
      await this.auditar(tx, actorId, 'usuario.suspender', 'usuario', usuarioId, {
        email: usuario.email,
        motivo,
      })
    })

    await this.firebase.deshabilitar(usuario.firebase_uid).catch((err: unknown) => {
      console.warn('[admin] No se pudo deshabilitar la cuenta en Firebase:', err)
    })
    await desconectarSockets(usuarioId).catch((err: unknown) => {
      console.warn('[admin] No se pudieron cortar los sockets del usuario:', err)
    })

    return { id: usuarioId, suspendido_at: suspendidoAt, motivo_suspension: motivo }
  }

  async reactivarUsuario(actorId: string, usuarioId: string) {
    const usuario = await this.obtenerUsuarioOFallar(usuarioId)
    if (!usuario.suspendido_at) {
      throw new HttpError(409, 'La cuenta no está suspendida', 'NOT_SUSPENDED')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { suspendido_at: null, motivo_suspension: null },
      })
      await this.auditar(tx, actorId, 'usuario.reactivar', 'usuario', usuarioId, {
        email: usuario.email,
      })
    })
    await this.firebase.habilitar(usuario.firebase_uid).catch((err: unknown) => {
      console.warn('[admin] No se pudo rehabilitar la cuenta en Firebase:', err)
    })
    return { id: usuarioId, suspendido_at: null, motivo_suspension: null }
  }

  /**
   * RN-124: eliminación definitiva de una cuenta.
   *
   * - No se puede con un viaje en curso de por medio: primero hay que finalizarlo.
   * - Los grupos que lideraba pasan al integrante más antiguo, o se eliminan si no
   *   queda nadie (misma regla que RN-013).
   * - Los viajes que creó pasan al integrante más antiguo que participó; si no hubo
   *   nadie más, se eliminan. Así no se borra el historial de los demás.
   * - Todo lo demás (GPS propio, métricas, paradas, amistades, checklist, gastos)
   *   cae en cascada con la fila del usuario.
   *
   * La cuenta de Firebase se borra ANTES que la fila: si se borrara después y
   * fallara, el próximo login de esa persona recrearía su usuario vacío
   * (`findOrCreateByFirebaseUid`). Si falla lo de la base, reintentar es seguro.
   */
  async eliminarUsuario(actorId: string, usuarioId: string) {
    if (actorId === usuarioId) {
      throw new HttpError(400, 'No podés eliminar tu propia cuenta', 'CANNOT_DELETE_SELF')
    }
    const usuario = await this.obtenerUsuarioOFallar(usuarioId)

    const viajeEnCurso = await this.prisma.viaje.findFirst({
      where: {
        estado: 'en_curso',
        OR: [
          { creador_id: usuarioId },
          { integrantes: { some: { usuario_id: usuarioId, estado: 'confirmado' } } },
        ],
      },
      select: { id: true },
    })
    if (viajeEnCurso) {
      throw new HttpError(
        409,
        'El usuario está en un viaje en curso. Finalizalo antes de eliminar la cuenta.',
        'USER_IN_ACTIVE_TRIP'
      )
    }

    try {
      await this.firebase.eliminar(usuario.firebase_uid)
    } catch (err) {
      console.error('[admin] No se pudo eliminar la cuenta en Firebase:', err)
      throw new HttpError(
        502,
        'No se pudo eliminar la cuenta en el proveedor de autenticación. Reintentá.',
        'AUTH_PROVIDER_ERROR'
      )
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const r = { grupos_transferidos: 0, grupos_eliminados: 0, viajes_transferidos: 0, viajes_eliminados: 0 }

      const grupos = await tx.grupo.findMany({
        where: { lider_id: usuarioId },
        select: { id: true },
      })
      for (const { id: grupoId } of grupos) {
        const sucesor = await tx.grupoMiembro.findFirst({
          where: { grupo_id: grupoId, usuario_id: { not: usuarioId } },
          orderBy: { fecha_union: 'asc' },
          select: { usuario_id: true },
        })
        if (sucesor) {
          await tx.grupo.update({ where: { id: grupoId }, data: { lider_id: sucesor.usuario_id } })
          await tx.grupoMiembro.update({
            where: { grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: sucesor.usuario_id } },
            data: { rol: 'lider' },
          })
          r.grupos_transferidos++
        } else {
          await tx.grupo.delete({ where: { id: grupoId } })
          r.grupos_eliminados++
        }
      }

      const viajes = await tx.viaje.findMany({
        where: { creador_id: usuarioId },
        select: { id: true },
      })
      for (const { id: viajeId } of viajes) {
        const sucesor = await tx.viajeIntegrante.findFirst({
          where: {
            viaje_id: viajeId,
            usuario_id: { not: usuarioId },
            estado: { in: ['confirmado', 'salido'] },
          },
          orderBy: { created_at: 'asc' },
          select: { usuario_id: true },
        })
        if (sucesor) {
          await tx.viaje.update({ where: { id: viajeId }, data: { creador_id: sucesor.usuario_id } })
          r.viajes_transferidos++
        } else {
          await tx.viaje.delete({ where: { id: viajeId } })
          r.viajes_eliminados++
        }
      }

      await this.auditar(tx, actorId, 'usuario.eliminar', 'usuario', usuarioId, {
        email: usuario.email,
        nombre: usuario.nombre,
        ...r,
      })
      await tx.usuario.delete({ where: { id: usuarioId } })
      return r
    })

    return { usuario_id: usuarioId, accion: 'eliminado' as const, ...resultado }
  }

  // ── Grupos ───────────────────────────────────────────────────────────────

  async listarGrupos(query: ListarGruposQuery) {
    const where: Prisma.GrupoWhereInput = filtroTexto(query.q, ['nombre'])
    const [filas, total] = await Promise.all([
      this.prisma.grupo.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          fecha_creacion: true,
          lider: { select: personaSelect },
          _count: { select: { miembros: true } },
        },
        orderBy: { fecha_creacion: 'desc' },
        ...paginar(query.pagina, query.limite),
      }),
      this.prisma.grupo.count({ where }),
    ])
    const items = filas.map(({ _count, ...g }) => ({ ...g, cantidad_miembros: _count.miembros }))
    return { items, total, pagina: query.pagina, limite: query.limite }
  }

  async detalleGrupo(grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: {
        id: true,
        nombre: true,
        fecha_creacion: true,
        lider_id: true,
        miembros: {
          select: { rol: true, fecha_union: true, usuario: { select: personaSelect } },
          orderBy: { fecha_union: 'asc' },
        },
        _count: { select: { viajes: true } },
      },
    })
    if (!grupo) throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    const { miembros, _count, ...datos } = grupo
    return {
      ...datos,
      cantidad_viajes: _count.viajes,
      miembros: miembros.map((m) => ({ ...m.usuario, rol: m.rol, fecha_union: m.fecha_union })),
    }
  }

  /** RN-125: reasignar el líder. Sigue habiendo exactamente un líder (RN-011). */
  async reasignarLider(actorId: string, grupoId: string, nuevoLiderId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { lider_id: true, nombre: true },
    })
    if (!grupo) throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    if (grupo.lider_id === nuevoLiderId) {
      throw new HttpError(409, 'Esa persona ya es la líder del grupo', 'ALREADY_LEADER')
    }
    const miembro = await this.prisma.grupoMiembro.findUnique({
      where: { grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: nuevoLiderId } },
      select: { usuario_id: true },
    })
    if (!miembro) {
      throw new HttpError(404, 'Integrante no encontrado en el grupo', 'MEMBER_NOT_FOUND')
    }

    await this.prisma.$transaction(async (tx) => {
      await transferirLiderazgo(tx, grupoId, nuevoLiderId, grupo.lider_id)
      await this.auditar(tx, actorId, 'grupo.reasignar_lider', 'grupo', grupoId, {
        nombre: grupo.nombre,
        lider_anterior_id: grupo.lider_id,
        lider_nuevo_id: nuevoLiderId,
      })
    })
    return { grupo_id: grupoId, lider_id: nuevoLiderId }
  }

  /**
   * Quitar a alguien de un grupo. Si es el líder, se aplica RN-013: el rol pasa al
   * integrante más antiguo y, si no queda nadie, el grupo se elimina.
   */
  async quitarMiembro(actorId: string, grupoId: string, usuarioId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { lider_id: true, nombre: true },
    })
    if (!grupo) throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    const miembro = await this.prisma.grupoMiembro.findUnique({
      where: { grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId } },
      select: { usuario_id: true },
    })
    if (!miembro) {
      throw new HttpError(404, 'Integrante no encontrado en el grupo', 'MEMBER_NOT_FOUND')
    }

    return this.prisma.$transaction(async (tx) => {
      const claveMiembro = { grupo_id_usuario_id: { grupo_id: grupoId, usuario_id: usuarioId } }
      let accion: 'quitado' | 'grupo_eliminado' = 'quitado'
      let nuevoLiderId: string | null = null

      if (grupo.lider_id === usuarioId) {
        const sucesor = await tx.grupoMiembro.findFirst({
          where: { grupo_id: grupoId, usuario_id: { not: usuarioId } },
          orderBy: { fecha_union: 'asc' },
          select: { usuario_id: true },
        })
        if (sucesor) {
          await transferirLiderazgo(tx, grupoId, sucesor.usuario_id, usuarioId)
          await tx.grupoMiembro.delete({ where: claveMiembro })
          nuevoLiderId = sucesor.usuario_id
        } else {
          await tx.grupo.delete({ where: { id: grupoId } })
          accion = 'grupo_eliminado'
        }
      } else {
        await tx.grupoMiembro.delete({ where: claveMiembro })
      }

      await this.auditar(tx, actorId, 'grupo.quitar_miembro', 'grupo', grupoId, {
        nombre: grupo.nombre,
        usuario_id: usuarioId,
        resultado: accion,
        lider_nuevo_id: nuevoLiderId,
      })
      return { grupo_id: grupoId, usuario_id: usuarioId, accion, lider_id: nuevoLiderId }
    })
  }

  async eliminarGrupo(actorId: string, grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { nombre: true, lider_id: true },
    })
    if (!grupo) throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    await this.prisma.$transaction(async (tx) => {
      await this.auditar(tx, actorId, 'grupo.eliminar', 'grupo', grupoId, {
        nombre: grupo.nombre,
        lider_id: grupo.lider_id,
      })
      await tx.grupo.delete({ where: { id: grupoId } })
    })
    return { grupo_id: grupoId, accion: 'grupo_eliminado' as const }
  }

  // ── Viajes ───────────────────────────────────────────────────────────────

  async listarViajes(query: ListarViajesQuery) {
    const where: Prisma.ViajeWhereInput = {
      ...filtroTexto(query.q, ['nombre']),
      ...(query.estado ? { estado: query.estado } : {}),
    }
    const [filas, total] = await Promise.all([
      this.prisma.viaje.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          tipo_actividad: true,
          es_grupal: true,
          estado: true,
          fecha_programada: true,
          created_at: true,
          creador: { select: personaSelect },
          _count: { select: { integrantes: true } },
        },
        orderBy: { created_at: 'desc' },
        ...paginar(query.pagina, query.limite),
      }),
      this.prisma.viaje.count({ where }),
    ])
    const items = filas.map(({ _count, ...v }) => ({ ...v, cantidad_integrantes: _count.integrantes }))
    return { items, total, pagina: query.pagina, limite: query.limite }
  }

  /** Sin posiciones ni velocidades: RN-126 (privacidad) y RN-070 (moto). */
  async detalleViaje(viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        id: true,
        nombre: true,
        tipo_actividad: true,
        modo: true,
        es_grupal: true,
        estado: true,
        fecha_programada: true,
        fecha_inicio_real: true,
        fecha_fin_real: true,
        created_at: true,
        creador: { select: personaSelect },
        ruta: { select: { origen_nombre: true, destino_nombre: true, distancia_planeada_m: true } },
        integrantes: {
          select: { estado: true, origen: true, created_at: true, usuario: { select: personaSelect } },
          orderBy: { created_at: 'asc' },
        },
        grupos: { select: { grupo: { select: { id: true, nombre: true } } } },
        _count: { select: { alertas: true, paradas: true, gastos: true } },
      },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    const { integrantes, grupos, _count, ...datos } = viaje
    return {
      ...datos,
      integrantes: integrantes.map((i) => ({
        ...i.usuario,
        estado: i.estado,
        origen: i.origen,
        fecha_union: i.created_at,
      })),
      grupos: grupos.map((g) => g.grupo),
      totales: { alertas: _count.alertas, paradas: _count.paradas, gastos: _count.gastos },
    }
  }

  async finalizarViaje(actorId: string, viajeId: string) {
    const actualizado = await this.viajes.finalizarComoAdmin(viajeId)
    await this.auditar(this.prisma, actorId, 'viaje.finalizar', 'viaje', viajeId, {
      nombre: actualizado.nombre,
      creador_id: actualizado.creador_id,
    })
    return {
      viaje_id: viajeId,
      estado: actualizado.estado,
      fecha_fin_real: actualizado.fecha_fin_real,
    }
  }

  /** Cualquier estado salvo `en_curso`: con gente en ruta primero se finaliza. */
  async eliminarViaje(actorId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { nombre: true, estado: true, creador_id: true },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    if (viaje.estado === 'en_curso') {
      throw new HttpError(
        409,
        'No se puede eliminar un viaje en curso. Finalizalo primero.',
        'INVALID_STATE'
      )
    }
    await this.prisma.$transaction(async (tx) => {
      await this.auditar(tx, actorId, 'viaje.eliminar', 'viaje', viajeId, {
        nombre: viaje.nombre,
        estado: viaje.estado,
        creador_id: viaje.creador_id,
      })
      await tx.viaje.delete({ where: { id: viajeId } })
    })
    return { viaje_id: viajeId, accion: 'eliminado' as const }
  }

  // ── Auditoría ────────────────────────────────────────────────────────────

  async listarAuditoria(query: ListarAuditoriaQuery) {
    const where: Prisma.AuditoriaAdminWhereInput = {
      ...(query.accion ? { accion: query.accion } : {}),
      ...(query.entidad ? { entidad: query.entidad } : {}),
      ...(query.entidad_id ? { entidad_id: query.entidad_id } : {}),
    }
    const [items, total] = await Promise.all([
      this.prisma.auditoriaAdmin.findMany({
        where,
        select: {
          id: true,
          accion: true,
          entidad: true,
          entidad_id: true,
          detalle: true,
          created_at: true,
          actor: { select: personaSelect },
        },
        orderBy: { created_at: 'desc' },
        ...paginar(query.pagina, query.limite),
      }),
      this.prisma.auditoriaAdmin.count({ where }),
    ])
    return { items, total, pagina: query.pagina, limite: query.limite }
  }
}
