import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { getIo } from '../../realtime/ioRegistry'
import type {
  IniciarParadaInput,
  ResponderSolicitudInput,
  SolicitarParadaInput,
} from './paradas.schemas'

/** Etiquetas de categoría para el texto de las notificaciones (RN-022). */
const ETIQUETA_CATEGORIA: Record<string, string> = {
  kiosco: 'un kiosco',
  combustible: 'cargar combustible',
  descanso: 'descansar',
  gastronomia: 'comer',
  punto_control: 'un punto de control',
  sanitario: 'el baño',
  otro: 'una parada',
}

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Un integrante'
}

function duracionSeg(inicio: Date, fin: Date): number {
  return Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 1000))
}

export class ParadasService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-030: el backend valida. Para operar sobre paradas hay que ser creador o
   * integrante confirmado de un viaje EN CURSO; el frontend solo orienta.
   */
  private async assertParticipaEnViajeEnCurso(
    viajeId: string,
    usuarioId: string
  ): Promise<{ creadorId: string; esLider: boolean }> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true, estado: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    }
    if (viaje.estado !== 'en_curso') {
      throw new HttpError(409, 'El viaje no está en curso', 'INVALID_STATE')
    }
    if (viaje.creador_id === usuarioId) {
      return { creadorId: viaje.creador_id, esLider: true }
    }

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    if (integrante?.estado !== 'confirmado') {
      throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    }
    return { creadorId: viaje.creador_id, esLider: false }
  }

  // ---------------------------------------------------------------- US1 / US3

  /** US1: registra la parada voluntaria con hora y ubicación, y avisa al grupo. */
  async iniciarParada(usuarioId: string, viajeId: string, input: IniciarParadaInput) {
    await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)

    const abierta = await this.prisma.parada.findFirst({
      where: { viaje_id: viajeId, usuario_id: usuarioId, fin: null },
      select: { id: true },
    })
    if (abierta) {
      throw new HttpError(409, 'Ya tenés una parada en curso', 'PARADA_ABIERTA')
    }

    const parada = await this.prisma.parada.create({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        lat: input.lat,
        lng: input.lng,
        categoria: input.categoria,
        tipo: 'voluntaria',
      },
      include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
    })

    const payload = {
      viajeId,
      paradaId: parada.id,
      usuarioId,
      nombre: nombreDe(parada.usuario),
      lat: parada.lat,
      lng: parada.lng,
      categoria: parada.categoria,
      inicio: parada.inicio.toISOString(),
      estado: 'detenido_voluntario' as const,
    }
    this.emitir(viajeId, 'viaje:parada_iniciada', payload)
    void this.notificarParadaIniciada(viajeId, usuarioId, payload.nombre, parada.categoria)

    return this.mapParada(parada)
  }

  /** US3: cierra la parada abierta y devuelve cuánto duró. */
  async finalizarParada(usuarioId: string, viajeId: string) {
    await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)

    const abierta = await this.prisma.parada.findFirst({
      where: { viaje_id: viajeId, usuario_id: usuarioId, fin: null },
      orderBy: { inicio: 'desc' },
    })
    if (!abierta) {
      throw new HttpError(409, 'No tenés ninguna parada en curso', 'SIN_PARADA_ABIERTA')
    }

    const fin = new Date()
    const parada = await this.prisma.parada.update({
      where: { id: abierta.id },
      data: { fin },
      include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
    })

    this.emitir(viajeId, 'viaje:parada_finalizada', {
      viajeId,
      paradaId: parada.id,
      usuarioId,
      nombre: nombreDe(parada.usuario),
      inicio: parada.inicio.toISOString(),
      fin: fin.toISOString(),
      duracionSegundos: duracionSeg(parada.inicio, fin),
      estado: 'en_movimiento' as const,
    })

    return this.mapParada(parada)
  }

  /** Parada abierta del usuario, para rehidratar la pantalla al volver a entrar. */
  async miParadaActiva(usuarioId: string, viajeId: string) {
    await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)
    const abierta = await this.prisma.parada.findFirst({
      where: { viaje_id: viajeId, usuario_id: usuarioId, fin: null },
      orderBy: { inicio: 'desc' },
    })
    return abierta ? this.mapParada(abierta) : null
  }

  // --------------------------------------------------------------------- US2

  /** US2: el integrante le pide al líder detenerse. */
  async solicitarParada(usuarioId: string, viajeId: string, input: SolicitarParadaInput) {
    const { creadorId, esLider } = await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)
    if (esLider) {
      throw new HttpError(409, 'El líder no necesita solicitar una parada', 'ES_LIDER')
    }

    const pendiente = await this.prisma.solicitudParada.findFirst({
      where: { viaje_id: viajeId, solicitante_id: usuarioId, estado: 'pendiente' },
      select: { id: true },
    })
    if (pendiente) {
      throw new HttpError(409, 'Ya tenés una solicitud pendiente', 'SOLICITUD_PENDIENTE')
    }

    const solicitud = await this.prisma.solicitudParada.create({
      data: {
        viaje_id: viajeId,
        solicitante_id: usuarioId,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        motivo: input.motivo?.trim() || null,
      },
      include: { solicitante: { select: { id: true, nombre: true, apellido: true } } },
    })

    this.emitir(viajeId, 'viaje:solicitud_parada', {
      viajeId,
      solicitudId: solicitud.id,
      solicitanteId: usuarioId,
      nombre: nombreDe(solicitud.solicitante),
      motivo: solicitud.motivo,
      lat: solicitud.lat,
      lng: solicitud.lng,
      createdAt: solicitud.created_at.toISOString(),
    })
    void this.notificarSolicitudAlLider(
      viajeId,
      creadorId,
      nombreDe(solicitud.solicitante),
      solicitud.motivo
    )

    return this.mapSolicitud(solicitud)
  }

  /** US2: solo el líder resuelve (RN-030). El resultado le llega al solicitante. */
  async responderSolicitud(
    usuarioId: string,
    viajeId: string,
    solicitudId: string,
    input: ResponderSolicitudInput
  ) {
    const { esLider } = await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)
    if (!esLider) {
      throw new HttpError(403, 'Solo el líder puede responder solicitudes', 'FORBIDDEN')
    }

    const solicitud = await this.prisma.solicitudParada.findUnique({
      where: { id: solicitudId },
      select: { id: true, viaje_id: true, estado: true },
    })
    if (!solicitud || solicitud.viaje_id !== viajeId) {
      throw new HttpError(404, 'Solicitud no encontrada', 'SOLICITUD_NOT_FOUND')
    }
    if (solicitud.estado !== 'pendiente') {
      throw new HttpError(409, 'La solicitud ya fue resuelta', 'SOLICITUD_RESUELTA')
    }

    const actualizada = await this.prisma.solicitudParada.update({
      where: { id: solicitudId },
      data: {
        estado: input.decision,
        resuelta_por_id: usuarioId,
        resolved_at: new Date(),
      },
      include: {
        solicitante: { select: { id: true, nombre: true, apellido: true, push_token: true } },
      },
    })

    this.emitir(viajeId, 'viaje:solicitud_parada_resuelta', {
      viajeId,
      solicitudId: actualizada.id,
      solicitanteId: actualizada.solicitante_id,
      estado: actualizada.estado,
      resueltaPor: usuarioId,
      resolvedAt: actualizada.resolved_at?.toISOString() ?? null,
    })
    void this.notificarResolucionAlSolicitante(
      viajeId,
      actualizada.solicitante.push_token,
      actualizada.estado
    )

    return this.mapSolicitud(actualizada)
  }

  /** El integrante puede retirar su solicitud mientras nadie la haya resuelto. */
  async cancelarSolicitud(usuarioId: string, viajeId: string, solicitudId: string) {
    await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)

    const solicitud = await this.prisma.solicitudParada.findUnique({
      where: { id: solicitudId },
      select: { id: true, viaje_id: true, solicitante_id: true, estado: true },
    })
    if (!solicitud || solicitud.viaje_id !== viajeId) {
      throw new HttpError(404, 'Solicitud no encontrada', 'SOLICITUD_NOT_FOUND')
    }
    if (solicitud.solicitante_id !== usuarioId) {
      throw new HttpError(403, 'Solo podés cancelar tus propias solicitudes', 'FORBIDDEN')
    }
    if (solicitud.estado !== 'pendiente') {
      throw new HttpError(409, 'La solicitud ya fue resuelta', 'SOLICITUD_RESUELTA')
    }

    const actualizada = await this.prisma.solicitudParada.update({
      where: { id: solicitudId },
      data: { estado: 'cancelada', resolved_at: new Date() },
    })

    this.emitir(viajeId, 'viaje:solicitud_parada_resuelta', {
      viajeId,
      solicitudId: actualizada.id,
      solicitanteId: usuarioId,
      estado: 'cancelada' as const,
      resueltaPor: usuarioId,
      resolvedAt: actualizada.resolved_at?.toISOString() ?? null,
    })

    return this.mapSolicitud(actualizada)
  }

  /**
   * Solicitudes del viaje. El líder ve todas las pendientes (para resolverlas);
   * un participante ve solo las suyas, así conoce el estado de la que envió.
   */
  async listarSolicitudes(usuarioId: string, viajeId: string) {
    const { esLider } = await this.assertParticipaEnViajeEnCurso(viajeId, usuarioId)

    const filas = await this.prisma.solicitudParada.findMany({
      where: esLider
        ? { viaje_id: viajeId, estado: 'pendiente' }
        : { viaje_id: viajeId, solicitante_id: usuarioId },
      include: { solicitante: { select: { id: true, nombre: true, apellido: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    })

    return filas.map((f) => this.mapSolicitud(f))
  }

  // ------------------------------------------------------------------ helpers

  private mapParada(p: {
    id: string
    viaje_id: string
    usuario_id: string
    lat: number
    lng: number
    categoria: string | null
    inicio: Date
    fin: Date | null
  }) {
    return {
      id: p.id,
      viaje_id: p.viaje_id,
      usuario_id: p.usuario_id,
      lat: p.lat,
      lng: p.lng,
      categoria: p.categoria,
      inicio: p.inicio.toISOString(),
      fin: p.fin ? p.fin.toISOString() : null,
      duracion_segundos: p.fin ? duracionSeg(p.inicio, p.fin) : null,
    }
  }

  private mapSolicitud(s: {
    id: string
    viaje_id: string
    solicitante_id: string
    lat: number | null
    lng: number | null
    motivo: string | null
    estado: string
    created_at: Date
    resolved_at: Date | null
    solicitante?: { nombre: string; apellido: string | null }
  }) {
    return {
      id: s.id,
      viaje_id: s.viaje_id,
      solicitante_id: s.solicitante_id,
      solicitante_nombre: s.solicitante ? nombreDe(s.solicitante) : null,
      lat: s.lat,
      lng: s.lng,
      motivo: s.motivo,
      estado: s.estado,
      created_at: s.created_at.toISOString(),
      resolved_at: s.resolved_at ? s.resolved_at.toISOString() : null,
    }
  }

  /** El socket es best-effort: un fallo de tiempo real no debe voltear la request. */
  private emitir(viajeId: string, evento: string, payload: unknown): void {
    try {
      getIo().to(`viaje:${viajeId}`).emit(evento, payload)
    } catch (e) {
      console.warn(`[paradas] No se pudo emitir ${evento}:`, e)
    }
  }

  /** US1: la notificación va a todos los integrantes, menos quien se detuvo. */
  private async notificarParadaIniciada(
    viajeId: string,
    autorId: string,
    nombre: string,
    categoria: string | null
  ): Promise<void> {
    try {
      const viaje = await this.prisma.viaje.findUnique({
        where: { id: viajeId },
        select: { creador_id: true, creador: { select: { push_token: true } } },
      })
      const integrantes = await this.prisma.viajeIntegrante.findMany({
        where: { viaje_id: viajeId, estado: 'confirmado' },
        select: { usuario: { select: { id: true, push_token: true } } },
      })

      const destinos = new Map<string, string>()
      if (viaje && viaje.creador_id !== autorId && viaje.creador.push_token) {
        destinos.set(viaje.creador_id, viaje.creador.push_token)
      }
      for (const i of integrantes) {
        if (i.usuario.id !== autorId && i.usuario.push_token) {
          destinos.set(i.usuario.id, i.usuario.push_token)
        }
      }
      if (destinos.size === 0) return

      const motivo = categoria ? ETIQUETA_CATEGORIA[categoria] : null
      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush(
        [...destinos.values()].map((to) => ({
          to,
          title: 'Parada en el grupo',
          body: motivo ? `${nombre} se detuvo para ${motivo}.` : `${nombre} se detuvo.`,
          data: { viajeId },
          sound: 'default' as const,
        }))
      )
    } catch (e) {
      console.warn('[paradas] notificarParadaIniciada falló:', e)
    }
  }

  private async notificarSolicitudAlLider(
    viajeId: string,
    creadorId: string,
    nombre: string,
    motivo: string | null
  ): Promise<void> {
    try {
      const lider = await this.prisma.usuario.findUnique({
        where: { id: creadorId },
        select: { push_token: true },
      })
      if (!lider?.push_token) return

      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush([
        {
          to: lider.push_token,
          title: 'Solicitud de parada',
          body: motivo ? `${nombre}: "${motivo}"` : `${nombre} pide detenerse.`,
          data: { viajeId },
          sound: 'default' as const,
        },
      ])
    } catch (e) {
      console.warn('[paradas] notificarSolicitudAlLider falló:', e)
    }
  }

  private async notificarResolucionAlSolicitante(
    viajeId: string,
    pushToken: string | null,
    estado: string
  ): Promise<void> {
    if (!pushToken) return
    try {
      const { sendExpoPush } = await import('../../lib/expoPush')
      await sendExpoPush([
        {
          to: pushToken,
          title: estado === 'aprobada' ? 'Parada aprobada' : 'Parada rechazada',
          body:
            estado === 'aprobada'
              ? 'El líder aprobó tu solicitud de parada.'
              : 'El líder rechazó tu solicitud de parada.',
          data: { viajeId },
          sound: 'default' as const,
        },
      ])
    } catch (e) {
      console.warn('[paradas] notificarResolucionAlSolicitante falló:', e)
    }
  }
}
