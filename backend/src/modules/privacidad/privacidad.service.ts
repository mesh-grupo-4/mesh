import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { getIo } from '../../realtime/ioRegistry'
import { obtenerMotorEventos } from '../motor-eventos/motorEventos.service'
import { estadoCompartirUbicacion, VENTANA_ACCESO_MIN } from './privacidad.acceso'
import {
  VERSION_CONSENTIMIENTO_UBICACION,
  type ActualizarPrivacidadUsuarioInput,
  type ActualizarPrivacidadViajeInput,
} from './privacidad.schemas'

/** Tope del historial de accesos que se devuelve de una vez. */
const MAX_ACCESOS = 200

export class PrivacidadService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-030: la configuración de privacidad es del viaje, así que exige pertenecer
   * a él. No exige `confirmado` como el canal en vivo: alguien invitado todavía
   * pendiente tiene derecho a dejar elegido su ajuste antes de sumarse.
   */
  private async assertParticipaDelViaje(viajeId: string, usuarioId: string): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    if (viaje.creador_id === usuarioId) return

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    if (integrante && integrante.estado !== 'rechazado') return

    throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
  }

  async miPrivacidad(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        comparte_ubicacion_default: true,
        consentimiento_ubicacion_at: true,
        consentimiento_ubicacion_version: true,
      },
    })
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')

    // Una versión vieja del texto no vale como consentimiento vigente: hay que
    // volver a mostrarlo y que la persona lo acepte de nuevo (RN-110).
    const vigente =
      usuario.consentimiento_ubicacion_at != null &&
      usuario.consentimiento_ubicacion_version === VERSION_CONSENTIMIENTO_UBICACION

    return {
      comparte_ubicacion_default: usuario.comparte_ubicacion_default,
      consentimiento_otorgado: usuario.consentimiento_ubicacion_at != null,
      consentimiento_vigente: vigente,
      consentimiento_at: usuario.consentimiento_ubicacion_at?.toISOString() ?? null,
      consentimiento_version: usuario.consentimiento_ubicacion_version,
      version_vigente: VERSION_CONSENTIMIENTO_UBICACION,
      ventana_registro_accesos_min: VENTANA_ACCESO_MIN,
    }
  }

  async actualizarMiPrivacidad(usuarioId: string, input: ActualizarPrivacidadUsuarioInput) {
    const revoca = input.consentimiento_ubicacion === false

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(input.comparte_ubicacion_default !== undefined
          ? { comparte_ubicacion_default: input.comparte_ubicacion_default }
          : {}),
        ...(input.consentimiento_ubicacion === true
          ? {
              consentimiento_ubicacion_at: new Date(),
              consentimiento_ubicacion_version: VERSION_CONSENTIMIENTO_UBICACION,
            }
          : {}),
        ...(revoca
          ? { consentimiento_ubicacion_at: null, consentimiento_ubicacion_version: null }
          : {}),
      },
    })

    // RN-113: revocar el consentimiento tiene que surtir efecto ya, no en el
    // próximo viaje — se borra la posición viva publicada y se avisa a las salas
    // para que los mapas abiertos saquen el marcador.
    if (revoca) await this.ocultarUbicacionesPublicadas(usuarioId)

    return this.miPrivacidad(usuarioId)
  }

  async privacidadViaje(usuarioId: string, viajeId: string) {
    await this.assertParticipaDelViaje(viajeId, usuarioId)
    const estado = await estadoCompartirUbicacion(this.prisma, viajeId, usuarioId)
    const fila = await this.prisma.privacidadViaje.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { comparte_ubicacion: true, updated_at: true },
    })

    return {
      viaje_id: viajeId,
      // Lo que eligió la persona. `comparte_efectivo` puede ser false igual si
      // todavía no hay consentimiento: son dos cosas distintas y la UI las
      // muestra distinto ("apagado por vos" vs "falta aceptar el consentimiento").
      comparte_ubicacion: fila?.comparte_ubicacion ?? null,
      comparte_efectivo: estado.comparte,
      consentimiento_otorgado: estado.consentimientoOtorgado,
      actualizado_en: fila?.updated_at.toISOString() ?? null,
    }
  }

  async actualizarPrivacidadViaje(
    usuarioId: string,
    viajeId: string,
    input: ActualizarPrivacidadViajeInput
  ) {
    await this.assertParticipaDelViaje(viajeId, usuarioId)

    await this.prisma.privacidadViaje.upsert({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      create: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        comparte_ubicacion: input.comparte_ubicacion,
      },
      update: { comparte_ubicacion: input.comparte_ubicacion },
    })

    // Apagar el compartir tiene que borrar la última posición publicada, no solo
    // dejar de publicar nuevas: si no, el grupo seguiría viendo el marcador
    // congelado donde la persona estaba al momento de apagarlo.
    if (!input.comparte_ubicacion) await this.ocultarUbicacionEnViaje(viajeId, usuarioId)

    return this.privacidadViaje(usuarioId, viajeId)
  }

  /** Borra la posición viva del viaje y avisa a la sala para que saquen el marcador. */
  private async ocultarUbicacionEnViaje(viajeId: string, usuarioId: string): Promise<void> {
    await this.prisma.ubicacionViva.deleteMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
    })
    const motor = obtenerMotorEventos(this.prisma)
    // Dejar de recibir pings no basta: el motor guarda en memoria desde cuándo
    // está quieta cada persona. Sin limpiarlo, el próximo ping tras volver a
    // encender arrastraría una detención acumulada mientras estaba oculta y
    // dispararía un "posible incidente" falso (RN-036).
    motor.limpiarIntegrante(viajeId, usuarioId)
    await motor.resolverAlertasSistemaDe(viajeId, usuarioId)
    getIo().to(`viaje:${viajeId}`).emit('viaje:ubicacion_oculta', { viajeId, usuarioId })
  }

  /** Idem para todos los viajes donde la persona tenga posición publicada. */
  private async ocultarUbicacionesPublicadas(usuarioId: string): Promise<void> {
    const vivas = await this.prisma.ubicacionViva.findMany({
      where: { usuario_id: usuarioId },
      select: { viaje_id: true },
    })
    if (vivas.length === 0) return

    await this.prisma.ubicacionViva.deleteMany({ where: { usuario_id: usuarioId } })
    for (const { viaje_id } of vivas) {
      getIo().to(`viaje:${viaje_id}`).emit('viaje:ubicacion_oculta', { viajeId: viaje_id, usuarioId })
    }
  }

  /** RN-112: quiénes accedieron a mi posición, en todos mis viajes. */
  async misAccesos(usuarioId: string) {
    const filas = await this.prisma.accesoUbicacion.findMany({
      where: { observado_id: usuarioId },
      orderBy: { ultima_vez: 'desc' },
      take: MAX_ACCESOS,
      select: {
        viaje_id: true,
        observador_id: true,
        primera_vez: true,
        ultima_vez: true,
        veces: true,
        viaje: { select: { nombre: true, fecha_programada: true } },
        observador: { select: { nombre: true, apellido: true } },
      },
    })
    return filas.map((f) => ({
      viaje_id: f.viaje_id,
      viaje_nombre: f.viaje.nombre,
      viaje_fecha: f.viaje.fecha_programada.toISOString(),
      observador_id: f.observador_id,
      observador_nombre: nombreCompleto(f.observador),
      primera_vez: f.primera_vez.toISOString(),
      ultima_vez: f.ultima_vez.toISOString(),
      veces: f.veces,
    }))
  }

  /** RN-112: quiénes accedieron a mi posición dentro de un viaje concreto. */
  async accesosViaje(usuarioId: string, viajeId: string) {
    await this.assertParticipaDelViaje(viajeId, usuarioId)
    const filas = await this.prisma.accesoUbicacion.findMany({
      where: { viaje_id: viajeId, observado_id: usuarioId },
      orderBy: { ultima_vez: 'desc' },
      take: MAX_ACCESOS,
      select: {
        observador_id: true,
        primera_vez: true,
        ultima_vez: true,
        veces: true,
        observador: { select: { nombre: true, apellido: true } },
      },
    })
    return filas.map((f) => ({
      observador_id: f.observador_id,
      observador_nombre: nombreCompleto(f.observador),
      primera_vez: f.primera_vez.toISOString(),
      ultima_vez: f.ultima_vez.toISOString(),
      veces: f.veces,
    }))
  }
}

function nombreCompleto(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim()
}
