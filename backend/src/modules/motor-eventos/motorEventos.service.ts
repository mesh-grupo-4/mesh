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
import { prefijoAlertaAfectado, umbralesMotorPorActividad } from './motorEventos.config'

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
  creador_id: string
}

type EstadoDetencion = {
  anchorLat: number
  anchorLng: number
  quietoDesde: Date
}

/** Ubicaciones vivas más viejas que esto no entran al cálculo del bloque principal. */
const UBICACION_VIVA_MAX_EDAD_MS = 30_000

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Un integrante'
}

/**
 * Motor de eventos autónomo (RN-034, RN-035, RN-036): evalúa cada ping GPS y genera
 * alertas del sistema + paradas de incidente detectado cuando corresponde.
 */
export class MotorEventosService {
  /** Estado en memoria de detención por integrante y viaje. */
  private readonly detencionPorClave = new Map<string, EstadoDetencion>()

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
        creador_id: true,
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

    await Promise.all([
      this.evaluarDesvio(input, viaje.distancia_max_separacion),
      this.evaluarDetencionSospechosa(input, viaje.tipo_actividad, tieneParadaVoluntaria),
      this.evaluarAtraso(input, viaje, tieneParadaVoluntaria),
    ])
  }

  private clave(viajeId: string, usuarioId: string): string {
    return `${viajeId}:${usuarioId}`
  }

  private async evaluarDesvio(input: PingInput, umbralDesvioM: number): Promise<void> {
    const ruta = await this.prisma.ruta.findUnique({
      where: { viaje_id: input.viajeId },
      select: { linestring_geojson: true },
    })
    if (!ruta?.linestring_geojson) return

    const linestring = ruta.linestring_geojson as unknown as GeoJsonLineString
    const distM = await computeDistanciaPuntoARutaM(
      this.prisma,
      input.lat,
      input.lng,
      linestring
    )
    if (distM == null || distM <= umbralDesvioM) return

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: input.usuarioId },
      select: { nombre: true, apellido: true },
    })
    const nombre = usuario ? nombreDe(usuario) : 'Un integrante'

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
    tipoActividad: TipoActividad,
    tieneParadaVoluntaria: boolean
  ): Promise<void> {
    if (tieneParadaVoluntaria) {
      this.detencionPorClave.delete(this.clave(input.viajeId, input.usuarioId))
      return
    }

    const umbrales = umbralesMotorPorActividad(tipoActividad)
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
    const umbralMs = umbrales.detencionMinutos * 60 * 1000
    if (quietoMs < umbralMs) return

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: input.usuarioId },
      select: { nombre: true, apellido: true },
    })
    const nombre = usuario ? nombreDe(usuario) : 'Un integrante'

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
      mensaje: `${prefijoAlertaAfectado(input.usuarioId)}Posible incidente — ${nombre} lleva ${umbrales.detencionMinutos} min detenido sin registrar parada`,
      tituloPush: 'Posible incidente',
      notificarSoloLider: true,
    })
  }

  /** RN-035: compara el progreso en ruta con el bloque principal del grupo. */
  private async evaluarAtraso(
    input: PingInput,
    viaje: ViajeMotor,
    tieneParadaVoluntaria: boolean
  ): Promise<void> {
    if (!viaje.es_grupal || tieneParadaVoluntaria) return

    const ruta = await this.prisma.ruta.findUnique({
      where: { viaje_id: input.viajeId },
      select: { linestring_geojson: true },
    })
    if (!ruta?.linestring_geojson) return

    const linestring = ruta.linestring_geojson as unknown as GeoJsonLineString
    const staleCutoff = new Date(Date.now() - UBICACION_VIVA_MAX_EDAD_MS)
    const ubicaciones = await this.prisma.ubicacionViva.findMany({
      where: { viaje_id: input.viajeId, updated_at: { gte: staleCutoff } },
      select: { usuario_id: true, lat: true, lng: true },
    })

    const posPorUsuario = new Map<string, { lat: number; lng: number }>()
    for (const u of ubicaciones) {
      posPorUsuario.set(u.usuario_id, { lat: u.lat, lng: u.lng })
    }
    posPorUsuario.set(input.usuarioId, { lat: input.lat, lng: input.lng })

    if (posPorUsuario.size < 2) return

    const miembros: MiembroEnRuta[] = []
    for (const [usuarioId, pos] of posPorUsuario) {
      const progresoM = await computeProgresoEnRutaM(
        this.prisma,
        pos.lat,
        pos.lng,
        linestring
      )
      if (progresoM == null) return
      miembros.push({ usuarioId, lat: pos.lat, lng: pos.lng, progresoM })
    }

    const bloque = identificarBloquePrincipal(miembros, viaje.distancia_max_separacion)
    if (!bloque) return

    const yo = miembros.find((m) => m.usuarioId === input.usuarioId)
    if (!yo) return

    const umbrales = umbralesMotorPorActividad(viaje.tipo_actividad)
    const umbralM = toleranciaAtrasoMetros(
      viaje.velocidad_esperada,
      umbrales.toleranciaAtrasoMinutos
    )
    const atrasoM = atrasoMetros(bloque.progresoReferenciaM, yo.progresoM)
    if (atrasoM <= umbralM) return

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: input.usuarioId },
      select: { nombre: true, apellido: true },
    })
    const nombre = usuario ? nombreDe(usuario) : 'Un integrante'

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

      if (soloLider) {
        if (viaje.creador.push_token && viaje.creador_id !== autorExcluidoId) {
          destinos.set(viaje.creador_id, viaje.creador.push_token)
        }
      } else {
        const integrantes = await this.prisma.viajeIntegrante.findMany({
          where: { viaje_id: viajeId, estado: 'confirmado' },
          select: { usuario: { select: { id: true, push_token: true } } },
        })
        if (viaje.creador.push_token && viaje.creador_id !== autorExcluidoId) {
          destinos.set(viaje.creador_id, viaje.creador.push_token)
        }
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
