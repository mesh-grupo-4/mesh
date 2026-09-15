import type { PrismaClient, TipoActividad } from '@prisma/client'
import {
  atrasoMetros,
  identificarBloquePrincipal,
  toleranciaAtrasoMetros,
  type MiembroEnRuta,
} from '../../lib/bloquePrincipal'
import { distanciaMetros } from '../../lib/geo2d'
import type { GeoJsonLineString } from '../../lib/geo'
import { computeDistanciaPuntoARutaM, computeProgresoEnRutaM } from '../../lib/postgis'
import { getIo } from '../../realtime/ioRegistry'
import {
  minutosIncidenteEfectivo,
  prefijoAlertaAfectado,
  umbralesMotorPorActividad,
} from './motorEventos.config'

type PingInput = {
  viajeId: string
  usuarioId: string
  lat: number
  lng: number
  timestamp: Date
}

type ViajeMotor = {
  id: string
  estado: string
  es_grupal: boolean
  tipo_actividad: TipoActividad
  distancia_max_separacion: number
  velocidad_esperada: number
  /** RN-025: null = tolerancia por actividad. */
  tolerancia_atraso_min?: number | null
  creador_id: string
  alerta_incidente_habilitada: boolean
  alerta_incidente_minutos: number | null
}

type EstadoDetencion = {
  anchorLat: number
  anchorLng: number
  quietoDesde: Date
}

type ProgresoCacheado = {
  lat: number
  lng: number
  progresoM: number
  /** Reloj del servidor al momento del ping, para descartar posiciones viejas. */
  at: number
}

/** Alertas del sistema abiertas para el integrante, leídas una vez por ping. */
type AlertaSistemaActiva = { id: string; tipo: string }

/** Progresos más viejos que esto no entran al cálculo del bloque principal. */
const PROGRESO_MAX_EDAD_MS = 30_000

/**
 * Histéresis de auto-resolución: la alerta de desvío/atraso se cierra sola recién
 * cuando el integrante vuelve por debajo de esta fracción del umbral. Sin esto,
 * quien va justo en el borde generaría alertas nuevas en cada ping.
 */
const FACTOR_RESOLUCION = 0.5

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Un integrante'
}

/**
 * Motor de eventos autónomo (RN-034, RN-035, RN-036): evalúa cada ping GPS y genera
 * alertas del sistema + paradas de incidente detectado cuando corresponde.
 *
 * Guarda estado en memoria por integrante (detención y progreso en ruta), así que
 * debe existir UNA sola instancia por proceso: usar `obtenerMotorEventos(prisma)`.
 */
export class MotorEventosService {
  /** Estado en memoria de detención por integrante y viaje. */
  private readonly detencionPorClave = new Map<string, EstadoDetencion>()
  /**
   * Último progreso en ruta por integrante. Evita recalcular con PostGIS el
   * progreso de TODO el grupo en cada ping (N² consultas por ciclo, RN-033):
   * cada ping calcula solo el propio y lee el de los demás de acá.
   */
  private readonly progresoPorClave = new Map<string, ProgresoCacheado>()

  constructor(private readonly prisma: PrismaClient) {}

  async procesarPing(input: PingInput): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: input.viajeId },
      select: {
        id: true,
        estado: true,
        es_grupal: true,
        tipo_actividad: true,
        distancia_max_separacion: true,
        velocidad_esperada: true,
        tolerancia_atraso_min: true,
        creador_id: true,
        alerta_incidente_habilitada: true,
        alerta_incidente_minutos: true,
      },
    })
    if (!viaje || viaje.estado !== 'en_curso') return

    const paradaAbierta = await this.prisma.parada.findFirst({
      where: { viaje_id: input.viajeId, usuario_id: input.usuarioId, fin: null },
      select: { id: true, tipo: true },
    })

    if (paradaAbierta?.tipo === 'incidente_detectado') {
      return
    }

    const tieneParadaVoluntaria = paradaAbierta != null

    const [activas, ruta] = await Promise.all([
      this.prisma.alerta.findMany({
        where: {
          viaje_id: input.viajeId,
          origen: 'sistema',
          estado: 'activa',
          mensaje: { startsWith: prefijoAlertaAfectado(input.usuarioId) },
        },
        select: { id: true, tipo: true },
      }),
      this.prisma.ruta.findUnique({
        where: { viaje_id: input.viajeId },
        select: { linestring_geojson: true },
      }),
    ])
    const linestring = (ruta?.linestring_geojson as unknown as GeoJsonLineString | null) ?? null

    await Promise.all([
      this.evaluarDesvio(input, viaje, linestring, tieneParadaVoluntaria, activas),
      this.evaluarDetencionSospechosa(input, viaje, tieneParadaVoluntaria),
      this.evaluarAtraso(input, viaje, linestring, tieneParadaVoluntaria, activas),
    ])
  }

  /** Olvida el estado en memoria de todos los integrantes de un viaje (al finalizar). */
  limpiarViaje(viajeId: string): void {
    const prefijo = `${viajeId}:`
    for (const key of this.detencionPorClave.keys()) {
      if (key.startsWith(prefijo)) this.detencionPorClave.delete(key)
    }
    for (const key of this.progresoPorClave.keys()) {
      if (key.startsWith(prefijo)) this.progresoPorClave.delete(key)
    }
  }

  /** Olvida el estado en memoria de un integrante (cuando sale del viaje). */
  limpiarIntegrante(viajeId: string, usuarioId: string): void {
    const key = this.clave(viajeId, usuarioId)
    this.detencionPorClave.delete(key)
    this.progresoPorClave.delete(key)
  }

  /**
   * Marca como resueltas las alertas del sistema abiertas de un integrante y avisa
   * a la sala. Lo usa el propio motor (volvió a la ruta / alcanzó al grupo) y los
   * flujos que cierran la situación desde afuera (confirmar "estoy bien", salir).
   */
  async resolverAlertasSistemaDe(
    viajeId: string,
    usuarioId: string,
    tipos?: ('desvio' | 'peligro' | 'atraso')[]
  ): Promise<void> {
    const abiertas = await this.prisma.alerta.findMany({
      where: {
        viaje_id: viajeId,
        origen: 'sistema',
        estado: 'activa',
        mensaje: { startsWith: prefijoAlertaAfectado(usuarioId) },
        ...(tipos ? { tipo: { in: tipos } } : {}),
      },
      select: { id: true },
    })
    if (abiertas.length === 0) return
    await this.resolverAlertas(
      viajeId,
      abiertas.map((a) => a.id)
    )
  }

  private clave(viajeId: string, usuarioId: string): string {
    return `${viajeId}:${usuarioId}`
  }

  private async evaluarDesvio(
    input: PingInput,
    viaje: ViajeMotor,
    linestring: GeoJsonLineString | null,
    tieneParadaVoluntaria: boolean,
    activas: AlertaSistemaActiva[]
  ): Promise<void> {
    if (!linestring) return

    const umbralDesvioM = viaje.distancia_max_separacion
    const distM = await computeDistanciaPuntoARutaM(this.prisma, input.lat, input.lng, linestring)
    if (distM == null) return

    const activa = activas.find((a) => a.tipo === 'desvio')
    if (activa) {
      // Volvió a la ruta: la alerta se cierra sola y habilita detectar el próximo desvío.
      if (distM <= umbralDesvioM * FACTOR_RESOLUCION) {
        await this.resolverAlertas(input.viajeId, [activa.id])
      }
      return
    }

    // Una parada voluntaria fuera del trazado (estación de servicio, mirador) no es un desvío.
    if (tieneParadaVoluntaria) return
    if (distM <= umbralDesvioM) return

    const nombre = await this.nombreUsuario(input.usuarioId)
    await this.crearAlertaSistema({
      viajeId: input.viajeId,
      usuarioAfectadoId: input.usuarioId,
      tipo: 'desvio',
      lat: input.lat,
      lng: input.lng,
      mensaje: `${prefijoAlertaAfectado(input.usuarioId)}${nombre} se desvió ~${Math.round(distM)} m de la ruta`,
      tituloPush: 'Desvío en la ruta',
      notificarSoloLider: true,
    })
  }

  private async evaluarDetencionSospechosa(
    input: PingInput,
    viaje: ViajeMotor,
    tieneParadaVoluntaria: boolean
  ): Promise<void> {
    // RN-036 solo aplica en salidas grupales: en individual no hay a quién alertar.
    if (!viaje.es_grupal || !viaje.alerta_incidente_habilitada) {
      this.detencionPorClave.delete(this.clave(input.viajeId, input.usuarioId))
      return
    }

    if (tieneParadaVoluntaria) {
      this.detencionPorClave.delete(this.clave(input.viajeId, input.usuarioId))
      return
    }

    const umbrales = umbralesMotorPorActividad(viaje.tipo_actividad)
    const detencionMinutos = minutosIncidenteEfectivo(
      viaje.tipo_actividad,
      viaje.alerta_incidente_minutos
    )
    const key = this.clave(input.viajeId, input.usuarioId)
    const prev = this.detencionPorClave.get(key)

    if (!prev) {
      this.detencionPorClave.set(key, {
        anchorLat: input.lat,
        anchorLng: input.lng,
        quietoDesde: input.timestamp,
      })
      return
    }

    // Un ping más viejo que el ancla (lote offline desordenado) no aporta nada.
    if (input.timestamp.getTime() < prev.quietoDesde.getTime()) return

    const movimientoM = distanciaMetros(prev.anchorLat, prev.anchorLng, input.lat, input.lng)
    if (movimientoM > umbrales.radioDetenidoM) {
      this.detencionPorClave.set(key, {
        anchorLat: input.lat,
        anchorLng: input.lng,
        quietoDesde: input.timestamp,
      })
      return
    }

    const quietoMs = input.timestamp.getTime() - prev.quietoDesde.getTime()
    const umbralMs = detencionMinutos * 60 * 1000
    if (quietoMs < umbralMs) return

    const nombre = await this.nombreUsuario(input.usuarioId)

    const parada = await this.prisma.parada.create({
      data: {
        viaje_id: input.viajeId,
        usuario_id: input.usuarioId,
        lat: input.lat,
        lng: input.lng,
        tipo: 'incidente_detectado',
      },
    })

    this.detencionPorClave.delete(key)

    this.emitir(input.viajeId, 'viaje:parada_iniciada', {
      viajeId: input.viajeId,
      paradaId: parada.id,
      usuarioId: input.usuarioId,
      nombre,
      lat: parada.lat,
      lng: parada.lng,
      categoria: null,
      inicio: parada.inicio.toISOString(),
      estado: 'posible_incidente' as const,
    })

    await this.crearAlertaSistema({
      viajeId: input.viajeId,
      usuarioAfectadoId: input.usuarioId,
      tipo: 'peligro',
      lat: input.lat,
      lng: input.lng,
      mensaje: `${prefijoAlertaAfectado(input.usuarioId)}Posible incidente — ${nombre} lleva ${detencionMinutos} min detenido sin registrar parada`,
      tituloPush: 'Posible incidente',
      notificarSoloLider: true,
    })
  }

  /** RN-035: compara el progreso en ruta con el bloque principal del grupo. */
  private async evaluarAtraso(
    input: PingInput,
    viaje: ViajeMotor,
    linestring: GeoJsonLineString | null,
    tieneParadaVoluntaria: boolean,
    activas: AlertaSistemaActiva[]
  ): Promise<void> {
    if (!viaje.es_grupal || !linestring) return

    const progresoM = await computeProgresoEnRutaM(this.prisma, input.lat, input.lng, linestring)
    if (progresoM == null) return

    const ahora = Date.now()
    this.progresoPorClave.set(this.clave(input.viajeId, input.usuarioId), {
      lat: input.lat,
      lng: input.lng,
      progresoM,
      at: ahora,
    })

    if (tieneParadaVoluntaria) return

    const prefijo = `${input.viajeId}:`
    const miembros: MiembroEnRuta[] = []
    for (const [key, p] of this.progresoPorClave) {
      if (!key.startsWith(prefijo)) continue
      if (ahora - p.at > PROGRESO_MAX_EDAD_MS) {
        this.progresoPorClave.delete(key)
        continue
      }
      miembros.push({
        usuarioId: key.slice(prefijo.length),
        lat: p.lat,
        lng: p.lng,
        progresoM: p.progresoM,
      })
    }
    if (miembros.length < 2) return

    const bloque = identificarBloquePrincipal(miembros, viaje.distancia_max_separacion)
    if (!bloque) return

    const umbralM = toleranciaAtrasoMetros(
      viaje.velocidad_esperada,
      viaje.tolerancia_atraso_min ??
        umbralesMotorPorActividad(viaje.tipo_actividad).toleranciaAtrasoMinutos
    )
    const atrasoM = atrasoMetros(bloque.progresoReferenciaM, progresoM)

    const activa = activas.find((a) => a.tipo === 'atraso')
    if (activa) {
      // Alcanzó al grupo: se cierra sola.
      if (atrasoM <= umbralM * FACTOR_RESOLUCION) {
        await this.resolverAlertas(input.viajeId, [activa.id])
      }
      return
    }
    if (atrasoM <= umbralM) return

    const nombre = await this.nombreUsuario(input.usuarioId)
    await this.crearAlertaSistema({
      viajeId: input.viajeId,
      usuarioAfectadoId: input.usuarioId,
      tipo: 'atraso',
      lat: input.lat,
      lng: input.lng,
      mensaje: `${prefijoAlertaAfectado(input.usuarioId)}${nombre} va ~${Math.round(atrasoM)} m atrás del grupo`,
      tituloPush: 'Integrante atrasado',
      notificarSoloLider: true,
    })
  }

  private async nombreUsuario(usuarioId: string): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, apellido: true },
    })
    return usuario ? nombreDe(usuario) : 'Un integrante'
  }

  private async resolverAlertas(viajeId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const resolvedAt = new Date()
    await this.prisma.alerta.updateMany({
      where: { id: { in: ids }, estado: 'activa' },
      data: { estado: 'resuelta', resolved_at: resolvedAt },
    })
    for (const alertaId of ids) {
      this.emitir(viajeId, 'viaje:alerta_actualizada', {
        viajeId,
        alertaId,
        estado: 'resuelta' as const,
        resolvedAt: resolvedAt.toISOString(),
      })
    }
  }

  private async crearAlertaSistema(input: {
    viajeId: string
    usuarioAfectadoId: string
    tipo: 'desvio' | 'peligro' | 'atraso'
    lat: number
    lng: number
    mensaje: string
    tituloPush: string
    notificarSoloLider?: boolean
  }): Promise<void> {
    // Red de seguridad ante pings concurrentes del mismo integrante: una sola
    // alerta activa por tipo y afectado.
    const duplicada = await this.prisma.alerta.findFirst({
      where: {
        viaje_id: input.viajeId,
        origen: 'sistema',
        tipo: input.tipo,
        estado: 'activa',
        mensaje: { startsWith: prefijoAlertaAfectado(input.usuarioAfectadoId) },
      },
      select: { id: true },
    })
    if (duplicada) return

    const alerta = await this.prisma.alerta.create({
      data: {
        viaje_id: input.viajeId,
        creada_por_id: null,
        tipo: input.tipo,
        origen: 'sistema',
        mensaje: input.mensaje,
        lat: input.lat,
        lng: input.lng,
      },
    })

    const payload = {
      id: alerta.id,
      viaje_id: alerta.viaje_id,
      creada_por_id: null as string | null,
      creada_por_nombre: null as string | null,
      tipo: alerta.tipo,
      origen: alerta.origen,
      mensaje: alerta.mensaje,
      lat: alerta.lat,
      lng: alerta.lng,
      estado: alerta.estado,
      created_at: alerta.created_at.toISOString(),
    }

    this.emitir(input.viajeId, 'viaje:alerta', { viajeId: input.viajeId, alerta: payload })
    void this.notificarPush(
      input.viajeId,
      input.usuarioAfectadoId,
      input.tituloPush,
      input.mensaje,
      input.notificarSoloLider ?? false
    )
  }

  private emitir(viajeId: string, evento: string, payload: unknown): void {
    try {
      getIo().to(`viaje:${viajeId}`).emit(evento, payload)
    } catch (e) {
      console.warn(`[motor-eventos] No se pudo emitir ${evento}:`, e)
    }
  }

  private async notificarPush(
    viajeId: string,
    autorExcluidoId: string,
    titulo: string,
    mensaje: string,
    soloLider: boolean
  ): Promise<void> {
    try {
      const viaje = await this.prisma.viaje.findUnique({
        where: { id: viajeId },
        select: { creador_id: true, creador: { select: { push_token: true } } },
      })
      if (!viaje) return

      const destinos = new Map<string, string>()
      const tokenLider = viaje.creador?.push_token ?? null

      if (tokenLider && viaje.creador_id !== autorExcluidoId) {
        destinos.set(viaje.creador_id, tokenLider)
      }
      if (!soloLider) {
        const integrantes = await this.prisma.viajeIntegrante.findMany({
          where: { viaje_id: viajeId, estado: 'confirmado' },
          select: { usuario: { select: { id: true, push_token: true } } },
        })
        for (const i of integrantes) {
          if (i.usuario.id !== autorExcluidoId && i.usuario.push_token) {
            destinos.set(i.usuario.id, i.usuario.push_token)
          }
        }
      }

      if (destinos.size === 0) return

      const { sendExpoPush } = await import('../../lib/expoPush')
      const cuerpo = mensaje.replace(/^\[afectado:[0-9a-f-]+\]\s*/i, '')
      await sendExpoPush(
        [...destinos.values()].map((to) => ({
          to,
          title: titulo,
          body: cuerpo,
          data: { viajeId, tipo: 'alerta_sistema' },
          sound: 'default' as const,
        }))
      )
    } catch (e) {
      console.warn('[motor-eventos] push falló:', e)
    }
  }
}

const motores = new WeakMap<PrismaClient, MotorEventosService>()

/**
 * Una instancia por cliente Prisma. El router REST y los sockets construyen cada
 * uno su `ViajesService`; sin esto había dos motores con estados de detención
 * separados y el contador de "posible incidente" se repartía entre ambos según
 * por qué canal llegara cada ping.
 */
export function obtenerMotorEventos(prisma: PrismaClient): MotorEventosService {
  let motor = motores.get(prisma)
  if (!motor) {
    motor = new MotorEventosService(prisma)
    motores.set(prisma, motor)
  }
  return motor
}
