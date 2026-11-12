import type { PrismaClient, TipoActividad } from '@prisma/client'
import { nombreVisible } from '../../lib/nombres'
import {
  atrasoMetros,
  identificarBloquePrincipal,
  toleranciaAtrasoMetros,
  type MiembroEnRuta,
} from '../../lib/bloquePrincipal'
import { distanciaMetros } from '../../lib/geo2d'
import { esMotorizado } from '../../lib/actividad'
import type { GeoJsonLineString } from '../../lib/geo'
import { computeDistanciaPuntoARutaM, computeProgresoEnRutaM } from '../../lib/postgis'
import { gravedadDeAlerta, type GravedadAviso } from '../../lib/gravedadAlerta'
import { HttpError } from '../../lib/httpError'
import { getIo } from '../../realtime/ioRegistry'
import { googleMapsApiKey } from '../../config/googleMaps'
import { RoutingService } from '../routing/routing.service'
import { armarLeaderboard, type IntegranteEnRuta } from '../viajes/leaderboard'
import { WHERE_INTEGRANTE_ACTIVO } from '../viajes/viajes.membership'
import {
  minutosIncidenteEfectivo,
  prefijoAlertaAfectado,
  umbralesMotorPorActividad,
} from './motorEventos.config'
import { recalcularRutaDesde, type RutaRecalculada } from './recalculoRuta'

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
  /** RN-071: en competitivo el motor emite el leaderboard en vivo. */
  modo?: string
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
  /**
   * RN-036: ya se cerró un posible incidente en este punto ("estoy bien" o el
   * líder lo resolvió). No se dispara otro hasta que la persona se aleje.
   */
  silenciado?: boolean
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

/**
 * RN-034b: el líder salió de la ruta. Mientras dura, quien va con él no genera
 * desvío individual y no se evalúa el atraso (la ruta vieja ya no es referencia).
 * - `pendiente`: se le preguntó al líder si recalcular; vence a los 2 min.
 * - `rechazado`: el líder dijo "volvemos"; dura hasta que vuelva a la ruta.
 * - `recalculando`: hay un recálculo en vuelo (evita dos a la vez).
 */
export type EstadoDesvioGrupal = 'pendiente' | 'rechazado' | 'recalculando'

type DesvioGrupal = {
  estado: EstadoDesvioGrupal
  /** Reloj del servidor cuando se detectó (o se reintentó) el desvío. */
  desde: number
  liderLat: number
  liderLng: number
}

export type DesvioGrupalSnapshot = {
  estado: EstadoDesvioGrupal | 'ninguno'
  desde: string | null
  recalculo_automatico_en: string | null
}

export type MotivoRecalculo = 'lider' | 'automatico'

/** RN-034b: sin respuesta del líder, la ruta se recalcula sola pasado este tiempo. */
export const ESPERA_RECALCULO_AUTOMATICO_MS = 2 * 60_000

/** Progresos más viejos que esto no entran al cálculo del bloque principal. */
const PROGRESO_MAX_EDAD_MS = 30_000
/** RN-071: el leaderboard se re-emite como máximo cada tanto por viaje. */
const LEADERBOARD_MIN_INTERVALO_MS = 3_000

/**
 * Histéresis de auto-resolución: la alerta de desvío/atraso se cierra sola recién
 * cuando el integrante vuelve por debajo de esta fracción del umbral. Sin esto,
 * quien va justo en el borde generaría alertas nuevas en cada ping.
 */
const FACTOR_RESOLUCION = 0.5

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return nombreVisible(u.nombre, u.apellido) || 'Un integrante'
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
  /** Nombres ya resueltos, para no consultar `usuario` en cada emisión del leaderboard. */
  private readonly nombrePorUsuario = new Map<string, string>()
  private readonly ultimoLeaderboardAt = new Map<string, number>()
  /**
   * RN-029b: integrantes cuyo GPS ya pasó cerca de la ruta. Hasta entonces el motor no
   * los evalúa. En memoria como el resto del estado: tras un reinicio del servidor se
   * re-arma con el próximo ping en ruta.
   */
  private readonly armados = new Set<string>()
  /** RN-034b: desvío del líder (y del grupo que lo sigue) por viaje. */
  private readonly desvioGrupalPorViaje = new Map<string, DesvioGrupal>()
  /**
   * RN-034b: participantes que avisaron que se desvían a propósito. No se les genera
   * otro desvío hasta que vuelvan a la ruta.
   */
  private readonly desvioVoluntario = new Set<string>()
  private routing: RoutingService | null = null

  constructor(private readonly prisma: PrismaClient) {}

  async procesarPing(input: PingInput): Promise<void> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: input.viajeId },
      select: {
        id: true,
        estado: true,
        es_grupal: true,
        tipo_actividad: true,
        modo: true,
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
    const distM = linestring
      ? await computeDistanciaPuntoARutaM(this.prisma, input.lat, input.lng, linestring)
      : null

    // RN-029b (red de seguridad): el motor no evalúa a nadie hasta que su primer ping
    // cae cerca de la ruta. Aunque alguien toque "Me sumo" desde su casa, no salta un
    // desvío, un atraso ni un posible incidente hasta que llega al recorrido.
    const key = this.clave(input.viajeId, input.usuarioId)
    if (!this.armados.has(key)) {
      if (distM != null && distM > viaje.distancia_max_separacion) return
      this.armados.add(key)
    }

    await Promise.all([
      this.evaluarDesvio(input, viaje, distM, tieneParadaVoluntaria, activas),
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
    for (const key of this.armados) {
      if (key.startsWith(prefijo)) this.armados.delete(key)
    }
    for (const key of this.desvioVoluntario) {
      if (key.startsWith(prefijo)) this.desvioVoluntario.delete(key)
    }
    this.desvioGrupalPorViaje.delete(viajeId)
  }

  /** Olvida el estado en memoria de un integrante (cuando sale del viaje). */
  limpiarIntegrante(viajeId: string, usuarioId: string): void {
    const key = this.clave(viajeId, usuarioId)
    this.detencionPorClave.delete(key)
    this.progresoPorClave.delete(key)
    this.armados.delete(key)
    this.desvioVoluntario.delete(key)
  }

  /** RN-034b: estado del desvío grupal, para hidratar la pantalla al abrirla. */
  estadoDesvioGrupal(viajeId: string): DesvioGrupalSnapshot {
    const d = this.desvioGrupalPorViaje.get(viajeId)
    if (!d) return { estado: 'ninguno', desde: null, recalculo_automatico_en: null }
    return {
      estado: d.estado,
      desde: new Date(d.desde).toISOString(),
      recalculo_automatico_en:
        d.estado === 'pendiente' ? new Date(d.desde + ESPERA_RECALCULO_AUTOMATICO_MS).toISOString() : null,
    }
  }

  /**
   * RN-034b: el líder dice "no, volvemos a la ruta". No se recalcula y quien va con
   * él sigue sin generar desvío individual hasta que vuelvan al trazado.
   * La autorización (que sea el líder) la valida quien llama.
   */
  rechazarDesvioGrupal(viajeId: string): DesvioGrupalSnapshot {
    const d = this.desvioGrupalPorViaje.get(viajeId)
    if (!d || d.estado !== 'pendiente') {
      throw new HttpError(409, 'No hay un desvío del grupo esperando respuesta', 'SIN_DESVIO_PENDIENTE')
    }
    d.estado = 'rechazado'
    const snapshot = this.estadoDesvioGrupal(viajeId)
    this.emitir(viajeId, 'viaje:desvio_grupal', { viajeId, ...snapshot })
    return snapshot
  }

  /**
   * RN-034b: el líder confirma que el grupo tomó otro camino. Recalcula la ruta desde
   * su última posición. Vale también si antes había dicho "volvemos" y cambió de idea.
   * La autorización (que sea el líder) la valida quien llama.
   */
  async confirmarDesvioGrupal(viajeId: string): Promise<RutaRecalculada> {
    const d = this.desvioGrupalPorViaje.get(viajeId)
    if (!d) {
      throw new HttpError(409, 'No hay un desvío del grupo para confirmar', 'SIN_DESVIO_PENDIENTE')
    }
    if (d.estado === 'recalculando') {
      throw new HttpError(409, 'La ruta ya se está recalculando', 'RECALCULO_EN_CURSO')
    }
    return this.recalcularRuta(viajeId, d, 'lider')
  }

  /**
   * RN-034b: un participante avisa que se desvía a propósito (va a cargar nafta, se
   * vuelve antes). Se cierra su alerta de desvío y no se le genera otra hasta que
   * vuelva a la ruta. La ruta del grupo no cambia: eso es solo del líder (RN-030).
   */
  async marcarDesvioVoluntario(viajeId: string, usuarioId: string): Promise<void> {
    const abiertas = await this.prisma.alerta.findMany({
      where: {
        viaje_id: viajeId,
        origen: 'sistema',
        tipo: 'desvio',
        estado: 'activa',
        mensaje: { startsWith: prefijoAlertaAfectado(usuarioId) },
      },
      select: { id: true },
    })
    if (abiertas.length === 0) {
      throw new HttpError(409, 'No tenés un desvío abierto', 'SIN_DESVIO_ACTIVO')
    }
    this.desvioVoluntario.add(this.clave(viajeId, usuarioId))
    await this.resolverAlertas(
      viajeId,
      abiertas.map((a) => a.id)
    )
    const nombre = await this.nombreUsuario(usuarioId)
    void this.notificarPush(
      viajeId,
      usuarioId,
      'Desvío a propósito',
      `${nombre} avisó que se desvía a propósito`,
      true,
      'informativa'
    )
  }

  /**
   * La ruta de un viaje en curso cambió desde afuera del motor (PUT de la ruta). El
   * progreso cacheado y el desvío grupal quedaron medidos contra el trazado viejo.
   */
  rutaReemplazada(viajeId: string): void {
    const prefijo = `${viajeId}:`
    for (const key of this.progresoPorClave.keys()) {
      if (key.startsWith(prefijo)) this.progresoPorClave.delete(key)
    }
    if (this.desvioGrupalPorViaje.delete(viajeId)) {
      this.emitir(viajeId, 'viaje:desvio_grupal', {
        viajeId,
        ...this.estadoDesvioGrupal(viajeId),
      })
    }
  }

  /**
   * RN-036: se cerró el posible incidente de un integrante. Si sigue quieto en el
   * mismo lugar no se le vuelve a generar otro incidente ahí mismo cada N minutos:
   * la detección se rearma recién cuando se aleja del punto.
   */
  silenciarDeteccionEnPunto(viajeId: string, usuarioId: string, lat: number, lng: number): void {
    this.detencionPorClave.set(this.clave(viajeId, usuarioId), {
      anchorLat: lat,
      anchorLng: lng,
      // Sin fecha real: el reloj del servidor puede ir adelantado respecto del
      // dispositivo y entonces se descartarían como "viejos" los pings que
      // muestran que la persona ya se alejó.
      quietoDesde: new Date(0),
      silenciado: true,
    })
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
    /** Distancia a la ruta ya calculada en `procesarPing`; null = sin ruta o sin dato. */
    distM: number | null,
    tieneParadaVoluntaria: boolean,
    activas: AlertaSistemaActiva[]
  ): Promise<void> {
    if (distM == null) return

    const umbralDesvioM = viaje.distancia_max_separacion
    const activa = activas.find((a) => a.tipo === 'desvio')

    // RN-034b: el desvío del líder es el del grupo. No se alerta: se le pregunta.
    if (input.usuarioId === viaje.creador_id) {
      await this.evaluarDesvioDelLider(input, distM, umbralDesvioM, tieneParadaVoluntaria, activa)
      return
    }

    const key = this.clave(input.viajeId, input.usuarioId)
    const vuelveALaRuta = distM <= umbralDesvioM * FACTOR_RESOLUCION
    if (vuelveALaRuta) this.desvioVoluntario.delete(key)

    // RN-034b: quien va con el líder mientras el grupo está fuera de la ruta no se
    // desvió solo. Si ya tenía una alerta (dobló antes que el líder), se cierra.
    const grupal = this.desvioGrupalPorViaje.get(input.viajeId)
    if (
      grupal &&
      distanciaMetros(input.lat, input.lng, grupal.liderLat, grupal.liderLng) <= umbralDesvioM
    ) {
      if (activa) await this.resolverAlertas(input.viajeId, [activa.id])
      return
    }

    if (activa) {
      // Volvió a la ruta: la alerta se cierra sola y habilita detectar el próximo desvío.
      if (vuelveALaRuta) {
        await this.resolverAlertas(input.viajeId, [activa.id])
      }
      return
    }

    // Una parada voluntaria fuera del trazado (estación de servicio, mirador) no es un desvío.
    if (tieneParadaVoluntaria) return
    if (distM <= umbralDesvioM) return
    // RN-034b: avisó que se desvía a propósito; no se insiste hasta que vuelva.
    if (this.desvioVoluntario.has(key)) return

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

  /**
   * RN-034b: el líder salió de la ruta. En vez de una alerta por cada integrante que
   * lo sigue, se le pregunta una sola vez si recalcular. Sin respuesta, a los 2 min se
   * recalcula solo (en moto o auto no puede tocar el teléfono). Si vuelve al trazado,
   * el desvío grupal se descarta.
   */
  private async evaluarDesvioDelLider(
    input: PingInput,
    distM: number,
    umbralDesvioM: number,
    tieneParadaVoluntaria: boolean,
    alertaPropia: AlertaSistemaActiva | undefined
  ): Promise<void> {
    const { viajeId } = input
    const d = this.desvioGrupalPorViaje.get(viajeId)

    if (distM <= umbralDesvioM * FACTOR_RESOLUCION) {
      if (alertaPropia) await this.resolverAlertas(viajeId, [alertaPropia.id])
      if (d && d.estado !== 'recalculando') {
        this.desvioGrupalPorViaje.delete(viajeId)
        this.emitir(viajeId, 'viaje:desvio_grupal', { viajeId, ...this.estadoDesvioGrupal(viajeId) })
      }
      return
    }

    if (d) {
      d.liderLat = input.lat
      d.liderLng = input.lng
      // Parado en una estación de servicio fuera del trazado: no se recalcula solo.
      if (tieneParadaVoluntaria) return
      if (d.estado === 'pendiente' && Date.now() - d.desde >= ESPERA_RECALCULO_AUTOMATICO_MS) {
        try {
          await this.recalcularRuta(viajeId, d, 'automatico')
        } catch (e) {
          console.warn('[motor-eventos] recálculo automático falló:', e)
        }
      }
      return
    }

    if (tieneParadaVoluntaria || distM <= umbralDesvioM) return

    const nuevo: DesvioGrupal = {
      estado: 'pendiente',
      desde: Date.now(),
      liderLat: input.lat,
      liderLng: input.lng,
    }
    this.desvioGrupalPorViaje.set(viajeId, nuevo)
    this.emitir(viajeId, 'viaje:desvio_grupal', { viajeId, ...this.estadoDesvioGrupal(viajeId) })
    // Solo al líder (autorExcluido vacío + soloLider): es quien decide.
    void this.notificarPush(
      viajeId,
      '',
      '¿Recalculamos la ruta?',
      'El grupo salió del recorrido. Si no respondés, se recalcula solo en 2 minutos.',
      true,
      'importante'
    )
  }

  /**
   * RN-034b: recalcula la ruta desde la posición del líder, reinicia lo que el motor
   * tenía medido contra el trazado viejo y avisa a todo el grupo.
   */
  private async recalcularRuta(
    viajeId: string,
    d: DesvioGrupal,
    motivo: MotivoRecalculo
  ): Promise<RutaRecalculada> {
    d.estado = 'recalculando'
    let ruta: RutaRecalculada
    try {
      ruta = await recalcularRutaDesde(this.prisma, this.obtenerRouting(), viajeId, {
        lat: d.liderLat,
        lng: d.liderLng,
      })
    } catch (e) {
      // Vuelve a esperar: el automático reintenta en otros 2 min y el líder puede reintentar ya.
      d.estado = 'pendiente'
      d.desde = Date.now()
      this.emitir(viajeId, 'viaje:desvio_grupal', { viajeId, ...this.estadoDesvioGrupal(viajeId) })
      throw e
    }

    this.desvioGrupalPorViaje.delete(viajeId)
    const prefijo = `${viajeId}:`
    for (const key of this.progresoPorClave.keys()) {
      if (key.startsWith(prefijo)) this.progresoPorClave.delete(key)
    }
    for (const key of this.desvioVoluntario) {
      if (key.startsWith(prefijo)) this.desvioVoluntario.delete(key)
    }

    // Desvíos y atrasos estaban medidos contra la ruta vieja. Se cierran todos: el
    // próximo ping de cada uno los vuelve a evaluar contra la nueva.
    const abiertas = await this.prisma.alerta.findMany({
      where: { viaje_id: viajeId, origen: 'sistema', estado: 'activa', tipo: { in: ['desvio', 'atraso'] } },
      select: { id: true },
    })
    await this.resolverAlertas(
      viajeId,
      abiertas.map((a) => a.id)
    )

    this.emitir(viajeId, 'viaje:ruta_actualizada', {
      viajeId,
      motivo,
      linestring: ruta.linestring,
      distanciaPlaneadaM: ruta.distancia_planeada_m,
      tiempoEstimadoSeg: ruta.tiempo_estimado_seg,
      recalculadaEn: new Date().toISOString(),
    })
    this.emitir(viajeId, 'viaje:desvio_grupal', { viajeId, ...this.estadoDesvioGrupal(viajeId) })

    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true },
    })
    void this.notificarPush(
      viajeId,
      // Si lo confirmó el líder, él ya lo sabe; si fue automático, también le avisa.
      motivo === 'lider' ? (viaje?.creador_id ?? '') : '',
      'Ruta recalculada',
      'El grupo tomó otro camino: el recorrido se actualizó en el mapa.',
      false,
      'importante'
    )
    return ruta
  }

  private obtenerRouting(): RoutingService {
    this.routing ??= new RoutingService(googleMapsApiKey())
    return this.routing
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
      // El conteo arranca cuando el integrante entra al viaje (primera posición que
      // recibe el servidor), no en el timestamp del punto: la primera lectura del
      // GPS suele ser una ubicación cacheada de minutos atrás, o un punto encolado
      // antes de iniciar el viaje, y con eso el incidente saltaba al instante.
      const ahora = Date.now()
      this.detencionPorClave.set(key, {
        anchorLat: input.lat,
        anchorLng: input.lng,
        quietoDesde: new Date(Math.max(input.timestamp.getTime(), ahora)),
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

    // Sigue en el punto de un incidente ya cerrado: no se repite la alerta.
    if (prev.silenciado) return

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
      // SCRUM-38 / RN-040: una posible caída la tiene que saber todo el grupo,
      // no solo el líder (desvío y atraso sí van solo al líder, SCRUM-32/33).
      notificarSoloLider: false,
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

    // RN-071: con el progreso propio ya cacheado, el leaderboard sale del caché.
    if (viaje.modo === 'competitivo' && !esMotorizado(viaje.tipo_actividad)) {
      void this.emitirLeaderboard(input.viajeId, viaje.velocidad_esperada, ahora)
    }

    if (tieneParadaVoluntaria) return
    // RN-034b: con el grupo fuera de la ruta, el progreso sobre el trazado viejo no
    // dice quién va atrás. Se retoma cuando vuelven o se recalcula la ruta.
    if (this.desvioGrupalPorViaje.has(input.viajeId)) return

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
    const cacheado = this.nombrePorUsuario.get(usuarioId)
    if (cacheado) return cacheado
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, apellido: true },
    })
    const nombre = usuario ? nombreDe(usuario) : 'Un integrante'
    this.nombrePorUsuario.set(usuarioId, nombre)
    return nombre
  }

  /** RN-071 (SCRUM-51): tabla en vivo a partir del progreso cacheado, con throttle por viaje. */
  private async emitirLeaderboard(viajeId: string, velocidadEsperada: number, ahora: number) {
    const ultimo = this.ultimoLeaderboardAt.get(viajeId) ?? 0
    if (ahora - ultimo < LEADERBOARD_MIN_INTERVALO_MS) return
    this.ultimoLeaderboardAt.set(viajeId, ahora)

    const prefijo = `${viajeId}:`
    const integrantes: IntegranteEnRuta[] = []
    for (const [key, p] of this.progresoPorClave) {
      if (!key.startsWith(prefijo) || ahora - p.at > PROGRESO_MAX_EDAD_MS * 4) continue
      const usuarioId = key.slice(prefijo.length)
      integrantes.push({
        usuarioId,
        nombre: await this.nombreUsuario(usuarioId),
        progresoM: p.progresoM,
        lat: p.lat,
        lng: p.lng,
        actualizadoEn: new Date(p.at).toISOString(),
      })
    }
    this.emitir(viajeId, 'viaje:leaderboard', {
      viajeId,
      filas: armarLeaderboard(integrantes, velocidadEsperada),
      generadoEn: new Date(ahora).toISOString(),
    })
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
      input.notificarSoloLider ?? false,
      gravedadDeAlerta(input.tipo)
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
    soloLider: boolean,
    gravedad: GravedadAviso
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
          // RN-029b: quien no se sumó al viaje no recibe las alertas en vivo.
          where: { viaje_id: viajeId, ...WHERE_INTEGRANTE_ACTIVO },
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
          gravedad,
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
