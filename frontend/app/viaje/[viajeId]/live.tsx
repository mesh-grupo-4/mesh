import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Btn } from '@/components/MeshUI'
import { meshAlert, meshConfirmDestructive } from '@/lib/meshAlert';

import { AlertaGrupalBanner } from '@/components/live/AlertaGrupalBanner'
import { AlertasButton } from '@/components/live/AlertasButton'
import { AjustesViajeSheet } from '@/components/live/AjustesViajeSheet'
import { CategoriaParadaSheet } from '@/components/live/CategoriaParadaSheet'
import { CrearAlertaSheet } from '@/components/live/CrearAlertaSheet'
import { CenterLocationButton } from '@/components/live/CenterLocationButton'
import { CercaMioButton } from '@/components/live/CercaMioButton'
import { LugaresSugeridosModal } from '@/components/lugares/LugaresSugeridosModal'
import { ParadaVoluntariaBanner } from '@/components/live/ParadaVoluntariaBanner'
import { SolicitudParadaBanner } from '@/components/live/SolicitudParadaBanner'
import { LlegadaDestinoBanner } from '@/components/live/LlegadaDestinoBanner'
import { EstoyBienBanner } from '@/components/live/EstoyBienBanner'
import { FantasmaPanel } from '@/components/live/FantasmaPanel'
import { FantasmaPickerModal } from '@/components/live/FantasmaPickerModal'
import { LeaderboardPanel } from '@/components/live/LeaderboardPanel'
import { LiveBottomPanel } from '@/components/live/LiveBottomPanel'
import { LiveMapView, type LiveMapViewHandle } from '@/components/live/LiveMapView'
import type { LiveMember } from '@/components/live/LiveMembersBar'
import { ALTO_HEADER_COMPACTO, LiveTripHeader } from '@/components/live/LiveTripHeader'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import { useCapaMapa } from '@/hooks/useCapaMapa'
import { useTheme } from '@/components/MeshUI'
import { BotonAyuda } from '@/components/ayuda/BotonAyuda'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_VIAJE_LIVE } from '@/components/ayuda/contenidoAyuda'
import { DEV_USER_ID, API_BASE_URL } from '@/constants/Config'
import { tamanoOutdoor } from '@/constants/Typography'
import { useAuth } from '@/context/AuthContext'
import { useAvanceRuta } from '@/hooks/useAvanceRuta'
import { useBreadcrumbTrail } from '@/hooks/useBreadcrumbTrail'
import { useFantasma } from '@/hooks/useFantasma'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useLiveLocations } from '@/hooks/useLiveLocations'
import { useLlegadaDestino } from '@/hooks/useLlegadaDestino'
import { useAlertas } from '@/hooks/useAlertas'
import { useParadas } from '@/hooks/useParadas'
import { useNextStopEta } from '@/hooks/useNextStopEta'
import { useTripMetrics } from '@/hooks/useTripMetrics'
import { uiConfigPorActividad } from '@/lib/activityUi'
import { esMotorizado } from '@/lib/activityDefaults'
import type { RouteStop } from '@/lib/geo/nextStop'
import { haversineDistanceM } from '@/lib/geo/haversine'
import { buscarLugaresCercanos, type CategoriaLugar, type LugarSugerido } from '@/lib/lugaresApi'
import { calcularGuiaHastaDestino } from '@/lib/osrmGuia'
import { useHapticaAlEntrar, useHapticaCriticaRepetida } from '@/lib/haptics'
import { avisarEnSegundoPlano, marcarViajeEnPantalla } from '@/hooks/usePushNotifications'
import { formatPaceMinKm, formatSpeedKmh } from '@/lib/format'
import { nombreCompleto } from '@/lib/nombres'
import { gravedadAlerta, type TipoAlertaApi } from '@/lib/alertasApi'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { motivoParadaLegible } from '@/lib/paradasApi'
import { waypointTieneCoords } from '@/components/route-config/routeTypes'
import { linestringToLatLng, waypointsFromRutaDetalle } from '@/lib/routePayload'
import { connectMeshSocket, joinViajeRoom } from '@/lib/meshSocket'
import {
  checkInPendienteLocal,
  detenerTrackingViaje,
  iniciarTrackingViaje,
  registrarCheckIn,
  solicitarPermisosUbicacion,
} from '@/lib/tracking/trackingControl'
import { AvisoUbicacion } from '@/components/AvisoUbicacion'
import { trackingConfigPorActividad } from '@/lib/tracking/trackingConfig'
import {
  listarParticipantesViaje,
  obtenerRuta,
  obtenerViaje,
  finalizarViaje,
  salirViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
  type TipoActividadApi,
} from '@/lib/viajesApi'

/** A pie o en bici se llega al punto; en moto o auto se estaciona cerca. */
const RADIO_LLEGADA_M = 40
const RADIO_LLEGADA_MOTOR_M = 70
/** Tope de espera de una lectura GPS fresca al entrar: adentro de un edificio puede no llegar nunca. */
const ESPERA_GPS_MS = 12000
/** Una posición conocida más vieja que esto ya no sirve para decir dónde estás. */
const POSICION_PREVIA_MAX_MS = 120000

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
}

export default function ViajeLiveScreen() {
  const router = useRouter()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()
  const mapRef = useRef<LiveMapViewHandle>(null)
  const insets = useSafeAreaInsets()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userFromQuery = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || backendUserId || DEV_USER_ID || ''
  }, [params.userId, backendUserId])

  const userId = userFromQuery
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null)
  const [routeStops, setRouteStops] = useState<RouteStop[]>([])
  /** Posición propia leída del GPS al entrar: centra el mapa y pinta "vos" sin esperar al primer ping. */
  const [posicionGps, setPosicionGps] = useState<{ latitude: number; longitude: number } | null>(null)
  const [gpsCenterFailed, setGpsCenterFailed] = useState(false)
  /** Modo "seguirme": el mapa se recentra solo mientras es true; se pausa si el usuario arrastra a mano. */
  const [siguiendo, setSiguiendo] = useState(true)
  const [fg, setFg] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapStyle, setMapStyle] = useCapaMapa()
  const [headerExpandido, setHeaderExpandido] = useState(false)
  const [accion, setAccion] = useState(false)
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false)
  const [componiendoAlerta, setComponiendoAlerta] = useState(false)
  const [eligiendoFantasma, setEligiendoFantasma] = useState(false)
  const [buscandoCerca, setBuscandoCerca] = useState(false)
  const [ajustando, setAjustando] = useState(false)
  const [guiaLugar, setGuiaLugar] = useState<{
    coords: [number, number][]
    destino: { lat: number; lng: number; nombre: string }
  } | null>(null)
  /** Alto real de la pila de banners: los botones flotantes se corren debajo. */
  const [altoBanners, setAltoBanners] = useState(0)
  /** Alto real de la botonera inferior, que creció con la fila de paradas. */
  const [altoBotonera, setAltoBotonera] = useState(0)
  /** Alto de la pantalla del viaje: junto con `topPanel` da cuánto asoma el panel inferior. */
  const [altoRaiz, setAltoRaiz] = useState(0)
  /** Borde superior del panel inferior, cuadro a cuadro (-1 = todavía no se midió). */
  const topPanel = useSharedValue(-1)

  const nameByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    if (viaje?.creador) {
      map[viaje.creador.id] = nombreCompleto(viaje.creador.nombre, viaje.creador.apellido)
    }
    for (const p of participantes) {
      if (p.estado === 'confirmado') {
        map[p.usuario.id] = nombreCompleto(p.usuario.nombre, p.usuario.apellido)
      }
    }
    return map
  }, [viaje, participantes])

  const { memberList, staleByUserId } = useLiveLocations({
    viajeId: viajeId ?? '',
    userId,
    nameByUserId,
    selfSeed: posicionGps ? { lat: posicionGps.latitude, lng: posicionGps.longitude } : null,
  })

  // Sale siempre del GPS: nunca del origen de la ruta, que solo sirve para encuadrar el mapa.
  const miLat = memberList.find((m) => m.usuarioId === userId)?.lat ?? posicionGps?.latitude
  const miLng = memberList.find((m) => m.usuarioId === userId)?.lng ?? posicionGps?.longitude
  const myPosition = useMemo(
    () => (miLat != null && miLng != null ? { lat: miLat, lng: miLng } : null),
    [miLat, miLng]
  )

  // Sin GPS (o sin haberse sumado) el mapa arranca en el origen de la ruta.
  const initialCenter = useMemo(() => {
    if (posicionGps) return posicionGps
    const origen = gpsCenterFailed ? routeLine?.[0] : undefined
    return origen ? { latitude: origen[0], longitude: origen[1] } : null
  }, [posicionGps, gpsCenterFailed, routeLine])

  const liveMembers = useMemo((): LiveMember[] => {
    const seen = new Set<string>()
    const list: LiveMember[] = []
    const onMap = new Set(memberList.map((m) => m.usuarioId))

    // SCRUM-33: separación en tiempo real respecto de mi última posición.
    const posPorId = new Map(memberList.map((m) => [m.usuarioId, m]))
    const separacionMax = viaje?.distancia_max_separacion ?? null
    const add = (id: string, nombre: string) => {
      if (seen.has(id)) return
      seen.add(id)
      const pos = posPorId.get(id)
      const distanciaM =
        myPosition && pos && id !== userId && !staleByUserId[id]
          ? haversineDistanceM(myPosition.lat, myPosition.lng, pos.lat, pos.lng)
          : null
      list.push({
        id,
        nombre,
        enMapa: onMap.has(id),
        sinSenal: staleByUserId[id] === true,
        distanciaM,
        lejos: distanciaM != null && separacionMax != null && distanciaM > separacionMax,
      })
    }

    if (viaje?.creador) {
      add(viaje.creador.id, nombreCompleto(viaje.creador.nombre, viaje.creador.apellido))
    }
    for (const p of participantes) {
      if (p.estado === 'confirmado') {
        add(p.usuario.id, nombreCompleto(p.usuario.nombre, p.usuario.apellido))
      }
    }
    for (const m of memberList) {
      add(m.usuarioId, m.nombre)
    }

    return list
  }, [viaje, participantes, memberList, staleByUserId, myPosition, userId])

  const tripDisplayName = useMemo(() => {
    if (viaje?.nombre?.trim()) return viaje.nombre.trim()
    return viaje?.es_grupal ? 'Salida grupal' : 'Salida individual'
  }, [viaje])

  const esLider = viaje != null && userId === viaje.creador_id
  /** "Me sumo" tocado sin señal: todavía no lo confirmó el backend pero ya cuenta. */
  const [checkInLocal, setCheckInLocal] = useState(false)
  const [sumandome, setSumandome] = useState(false)
  /**
   * RN-029b: solo quien se sumó comparte GPS y opera en vivo. Quien confirmó pero se
   * quedó en casa puede mirar el mapa sin que se lo trackee ni dispare alertas.
   */
  const sumado = esLider || !!viaje?.mi_participacion?.check_in_at || checkInLocal

  // RN-052: interfaz adaptativa por actividad (pantalla completa/alto contraste en
  // moto/auto, botones grandes, háptica prioritaria en trekking/running).
  const tipoActividad = (viaje?.tipo_actividad ?? 'otro') as TipoActividadApi
  const uiConfig = uiConfigPorActividad(tipoActividad)
  const theme = useTheme(uiConfig.altoContraste)

  // Solo tiene sentido pedirle una parada al líder si hay líder distinto de uno
  // mismo y el viaje es grupal: en una salida individual no hay a quién pedirle.
  const puedeSolicitarParada = viaje != null && viaje.es_grupal && !esLider && sumado

  const {
    paradaActiva,
    miSolicitud,
    pendientes,
    paradaEntrante,
    paradasEntrantes,
    seguirParada,
    enviando: paradaEnCurso,
    calculandoSeguir,
    registrarParada,
    retomarViaje,
    confirmarBien,
    confirmarMal,
    deshacerMal,
    pedirParada,
    responderSolicitud,
    descartarResultado,
    ignorarParadaEntrante,
    activarSeguirParada,
  } = useParadas({
    viajeId: viajeId ?? '',
    userId,
    esLider,
    habilitado: viaje?.estado === 'en_curso',
    tipoActividad,
    myPosition,
  })

  const guiaParada = useMemo(() => {
    if (!seguirParada) return null
    return {
      coords: seguirParada.polyline,
      destino: {
        lat: seguirParada.lat,
        lng: seguirParada.lng,
        nombre: seguirParada.nombre,
        categoria: seguirParada.categoria,
      },
    }
  }, [seguirParada])

  const {
    alertas,
    noVistas: alertasNoVistas,
    alertaEntrante,
    alertasEntrantes,
    seguirAlerta,
    enviando: alertaEnviando,
    calculandoSeguir: calculandoSeguirAlerta,
    publicar: publicarAlerta,
    ignorarAlertaEntrante,
    activarSeguirAlerta,
  } = useAlertas({
    viajeId: viajeId ?? '',
    userId,
    habilitado: Boolean(viajeId && userId.trim()),
    tipoActividad,
    myPosition,
  })

  const guiaAlerta = useMemo(() => {
    if (!seguirAlerta) return null
    return {
      coords: seguirAlerta.polyline,
      destino: {
        lat: seguirAlerta.lat,
        lng: seguirAlerta.lng,
        nombre: seguirAlerta.label,
      },
      color: '#4338ca',
    }
  }, [seguirAlerta])

  // "Cerca mío": la posición viaja al backend solo para esta búsqueda; no se
  // publica al grupo (RN-111) y se usa la que ya tiene el dispositivo.
  const buscarCercaMio = (categoria: CategoriaLugar): Promise<LugarSugerido[]> => {
    if (!myPosition) return Promise.resolve([])
    return buscarLugaresCercanos(categoria, myPosition.lat, myPosition.lng)
  }

  const distanciaHastaLugar = (lugar: LugarSugerido): string | null => {
    if (!myPosition) return null
    const m = haversineDistanceM(myPosition.lat, myPosition.lng, lugar.lat, lugar.lng)
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
  }

  const irALugar = async (lugar: LugarSugerido) => {
    setBuscandoCerca(false)
    if (!myPosition) return
    const coords = await calcularGuiaHastaDestino(myPosition, lugar, tipoActividad)
    setGuiaLugar({ coords, destino: { lat: lugar.lat, lng: lugar.lng, nombre: lugar.nombre } })
    // El encuadre de la guía es deliberado: como un arrastre manual, pausa el "seguirme".
    setSiguiendo(false)
    mapRef.current?.fitBoundsToCoords(coords)
  }

  const puedeCrearAlertas =
    viaje?.estado === 'en_curso' &&
    (esLider || (sumado && (viaje?.alertas_solo_lider ?? true) === false))

  // RN-030: el backend valida ambos; acá solo se decide qué accesos mostrar.
  const puedeGastos = viaje?.estado === 'en_curso' && viaje.es_grupal && sumado
  // RN-025: el líder corrige en vivo parámetros que disparan alertas de más.
  const puedeAjustar = viaje?.estado === 'en_curso' && viaje.es_grupal && esLider

  const centroMapaAlerta = useMemo(() => {
    if (myPosition) return { latitude: myPosition.lat, longitude: myPosition.lng }
    if (initialCenter) return initialCenter
    return { latitude: -31.4167, longitude: -64.1833 }
  }, [myPosition, initialCenter])

  const { elapsedLabel, distanceLabel, distanceM, velocidadActualKmh, velocidadPromedioKmh, paceMinKm } = useTripMetrics({
    viajeId: viajeId ?? '',
    userId,
    fechaInicioReal: viaje?.fecha_inicio_real ?? null,
    tipoActividad: viaje?.tipo_actividad ?? 'otro',
  })

  // RN-065: panel de entrenamiento. RN-070: en moto/auto no se muestran velocidades.
  const entrenamientoEnVivo = useMemo(() => {
    if (viaje?.modo !== 'entrenamiento' || esMotorizado(viaje.tipo_actividad)) return null
    const esPace = viaje.tipo_actividad === 'running' || viaje.tipo_actividad === 'trekking'
    return {
      velocidadActual: formatSpeedKmh(velocidadActualKmh),
      velocidadPromedio: formatSpeedKmh(velocidadPromedioKmh),
      ritmo: esPace ? formatPaceMinKm(paceMinKm) : formatSpeedKmh(velocidadPromedioKmh),
    }
  }, [viaje?.modo, viaje?.tipo_actividad, velocidadActualKmh, velocidadPromedioKmh, paceMinKm])

  // RN-072 / RN-070: sin comparaciones en recreativo ni en moto/auto.
  const permiteComparar =
    viaje?.estado === 'en_curso' && viaje.modo !== 'recreativo' && !esMotorizado(viaje.tipo_actividad)

  // RN-073: fantasma contra el reloj del viaje.
  const {
    fantasma,
    activo: fantasmaActivo,
    cargando: cargandoFantasma,
    activar: activarFantasma,
    quitar: quitarFantasma,
    alternarPausa: pausarFantasma,
  } = useFantasma({
    viajeId: viajeId ?? '',
    fechaInicioReal: viaje?.fecha_inicio_real ?? null,
    miDistanciaM: distanceM,
    habilitado: Boolean(permiteComparar),
    // RN-066: quien repite una sesión corre contra su propia traza de esa vez.
    refAutomatica:
      viaje?.repite_viaje_id && backendUserId && viaje.creador_id === backendUserId
        ? `viaje:${viaje.repite_viaje_id}:${backendUserId}`
        : null,
  })

  // RN-071: leaderboard en vivo solo en competitivo.
  const { filas: leaderboard } = useLeaderboard({
    viajeId: viajeId ?? '',
    habilitado: Boolean(permiteComparar && viaje?.modo === 'competitivo'),
  })

  const handleElegirFantasma = (ref: string) => {
    void activarFantasma(ref)
      .then(() => setEligiendoFantasma(false))
      .catch((e: unknown) => meshAlert('No se pudo cargar el fantasma', mensajeDeError(e)))
  }

  const hayRuta = routeLine != null && routeLine.length > 1

  // Con ruta planificada, lo ya recorrido se borra del mapa (como en un navegador):
  // la traza propia solo se dibuja en los viajes sin ruta, donde es lo único que hay.
  const breadcrumb = useBreadcrumbTrail({
    viajeId: viajeId ?? '',
    userId,
    tipoActividad: viaje?.tipo_actividad ?? 'otro',
    habilitado: viaje?.estado === 'en_curso' && !loading && !hayRuta,
  })

  const destino = useMemo(() => {
    const fin = routeStops.find((s) => s.type === 'DESTINATION')
    if (!fin) return null
    return { lat: fin.lat, lng: fin.lng, nombre: fin.name ?? null }
  }, [routeStops])

  const { ruta: rutaPreparada, avance } = useAvanceRuta({
    ruta: routeLine,
    pos: myPosition,
    distanciaRecorridaM: distanceM,
  })

  const nextStop = useNextStopEta({
    ruta: rutaPreparada,
    avance,
    stops: routeStops,
    velocidadEsperadaKmh: viaje?.velocidad_esperada ?? 30,
    velocidadActualKmh,
  })

  const finRuta = useMemo(() => {
    const fin = routeLine?.at(-1)
    return fin ? { lat: fin[0], lng: fin[1] } : null
  }, [routeLine])

  const alertasEnMapa = useMemo(
    () => alertas.filter((a) => a.estado === 'activa' && a.lat != null && a.lng != null),
    [alertas]
  )

  // RN-029b: solo llega quien se sumó; a quien mira desde su casa no se lo ubica.
  const { llegada, llego, descartar: descartarLlegada, destinoNombre } = useLlegadaDestino({
    destino,
    finRuta,
    pos: myPosition,
    avance,
    radioM: esMotorizado(tipoActividad) ? RADIO_LLEGADA_MOTOR_M : RADIO_LLEGADA_M,
    habilitado: viaje?.estado === 'en_curso' && sumado,
  })

  // Con el teléfono guardado el banner no se ve: la llegada también se avisa por notificación.
  useEffect(() => {
    if (llego) void avisarEnSegundoPlano('¡Llegaste!', destinoNombre)
  }, [llego, destinoNombre])

  const meta = useMemo(
    () => (destino ? { lat: destino.lat, lng: destino.lng, nombre: destinoNombre, alcanzada: llego } : null),
    [destino, destinoNombre, llego]
  )

  useEffect(() => {
    if (userId.trim()) void AsyncStorage.setItem('mesh:activeUserId', userId.trim())
  }, [userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [v, parts, ruta] = await Promise.all([
          obtenerViaje(viajeId, userId),
          listarParticipantesViaje(viajeId, userId),
          obtenerRuta(viajeId, userId),
        ])
        if (cancelled) return
        setViaje(v)
        setParticipantes(parts)
        setCheckInLocal(checkInPendienteLocal(viajeId, userId))
        if (ruta?.linestring) {
          setRouteLine(linestringToLatLng(ruta.linestring))
          const h = waypointsFromRutaDetalle(ruta)
          // Un waypoint sin coordenadas (parada sin geocodificar) no puede ser
          // "próxima parada": metía NaN en el ETA y en la detección de llegada.
          const stops: RouteStop[] = []
          if (waypointTieneCoords(h.origen)) {
            stops.push({ lat: h.origen.lat, lng: h.origen.lon, name: h.origen.name || 'Origen', type: 'ORIGIN' })
          }
          for (const p of h.paradas) {
            if (!waypointTieneCoords(p)) continue
            stops.push({ lat: p.lat, lng: p.lon, name: p.name || 'Parada', type: 'STOP' })
          }
          if (waypointTieneCoords(h.destino)) {
            stops.push({
              lat: h.destino.lat,
              lng: h.destino.lon,
              name: h.destino.name || 'Destino',
              type: 'DESTINATION',
            })
          }
          setRouteStops(stops)
        } else {
          setRouteStops([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    let cleanup: (() => void) | undefined

    void (async () => {
      joinViajeRoom(viajeId)
      const sock = await connectMeshSocket()

      const onFin = (payload: { viajeId: string }) => {
        if (payload.viajeId !== viajeId) return
        void detenerTrackingViaje()
        // El líder que finalizó maneja su propia navegación en ejecutarFinalizar.
        if (finalizandoRef.current) return
        // Para participantes: salir del mapa y mostrarles el resumen.
        router.replace({ pathname: '/viaje/[viajeId]/resumen', params: { viajeId } })
      }

      const onSalio = (payload: {
        viajeId: string
        usuarioId: string
        estado?: 'salido' | 'ausente'
      }) => {
        if (payload.viajeId !== viajeId) return
        setParticipantes((prev) =>
          prev.map((p) =>
            p.usuario.id === payload.usuarioId ? { ...p, estado: payload.estado ?? 'salido' } : p
          )
        )
      }

      // RN-029b: alguien tocó "Me sumo".
      const onSumado = (payload: { viajeId: string; usuarioId: string; checkInAt: string }) => {
        if (payload.viajeId !== viajeId) return
        setParticipantes((prev) =>
          prev.map((p) =>
            p.usuario.id === payload.usuarioId ? { ...p, check_in_at: payload.checkInAt } : p
          )
        )
      }

      // RN-029d: cambió el líder; se recarga el detalle para que los botones de
      // líder (finalizar, aprobar paradas) aparezcan en quien corresponde.
      const onLiderCambiado = (payload: { viajeId: string }) => {
        if (payload.viajeId !== viajeId) return
        void Promise.all([obtenerViaje(viajeId, userId), listarParticipantesViaje(viajeId, userId)])
          .then(([v, parts]) => {
            setViaje(v)
            setParticipantes(parts)
          })
          .catch((e) => console.warn('[live] no se pudo refrescar el viaje:', e))
      }

      sock.on('viaje:finalizado', onFin)
      sock.on('viaje:participante_salio', onSalio)
      sock.on('viaje:participante_sumado', onSumado)
      sock.on('viaje:lider_cambiado', onLiderCambiado)
      // El líder ajustó parámetros o alertas (RN-025): mismo refresco del detalle.
      sock.on('viaje:actualizado', onLiderCambiado)
      cleanup = () => {
        sock.off('viaje:actualizado', onLiderCambiado)
        sock.off('viaje:finalizado', onFin)
        sock.off('viaje:participante_salio', onSalio)
        sock.off('viaje:participante_sumado', onSumado)
        sock.off('viaje:lider_cambiado', onLiderCambiado)
      }
    })()

    return () => cleanup?.()
  }, [viajeId, userId, router])

  // Permisos, arranque del tracking y centrado inicial en la posición del usuario (AC1).
  // No depende de `routeLine`: hacerlo reiniciaba el GPS cada vez que cargaba la ruta.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!viajeId || !userId.trim() || !viaje || Platform.OS === 'web') return
      // RN-029b: sin "Me sumo" no se pide permiso ni se arranca el GPS; el mapa se
      // centra en el origen de la ruta.
      if (!sumado) {
        setGpsCenterFailed(true)
        return
      }
      const perm = await solicitarPermisosUbicacion()
      if (cancelled) return
      setFg(perm.foreground)
      if (!perm.foreground) {
        setGpsCenterFailed(true)
        return
      }

      const centrarEn = (pos: Location.LocationObject | null) => {
        if (cancelled || !pos) return false
        setPosicionGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        return true
      }

      // El centrado no espera al arranque del tracking: van en paralelo. Primero la
      // última posición conocida (inmediata) y después una lectura fresca que la corrige.
      const centrado = (async () => {
        const previa = centrarEn(
          await Location.getLastKnownPositionAsync({ maxAge: POSICION_PREVIA_MAX_MS }).catch(() => null)
        )
        const cfg = trackingConfigPorActividad(viaje.tipo_actividad)
        const fresca = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: cfg.accuracy }).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_GPS_MS)),
        ])
        if (!centrarEn(fresca) && !previa && !cancelled) setGpsCenterFailed(true)
      })()

      await iniciarTrackingViaje(viajeId, userId.trim(), viaje.tipo_actividad)
      await centrado
    })()
    return () => {
      cancelled = true
    }
  }, [viajeId, userId, viaje?.tipo_actividad, sumado])

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((r) => setFg(r.status === 'granted'))
  }, [])

  // Evita que el socket `viaje:finalizado` muestre un segundo diálogo cuando
  // es el propio líder quien acaba de finalizar el viaje.
  const finalizandoRef = useRef(false)

  const confirmarFinalizar = () => {
    meshAlert(
      'Finalizar viaje',
      '¿Estás seguro? Esto detendrá el tracking de todos los participantes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: () => void ejecutarFinalizar() },
      ]
    )
  }

  const ejecutarFinalizar = async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    finalizandoRef.current = true
    try {
      await finalizarViaje(viajeId, userId)
      void detenerTrackingViaje()
      router.replace({ pathname: '/viaje/[viajeId]/resumen', params: { viajeId } })
    } catch (e) {
      finalizandoRef.current = false
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo finalizar el viaje')
      setAccion(false)
    }
  }

  const confirmarSalir = () => {
    // RN-029c: si nunca se sumó no hay ubicación que dejar de compartir: avisa que no va.
    meshAlert(
      sumado ? 'Salir del viaje' : 'No voy a ir',
      sumado
        ? '¿Estás seguro? Dejarás de compartir tu ubicación con el grupo.'
        : '¿Seguro? El grupo va a ver que no vas a participar de este viaje.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: sumado ? 'Salir' : 'No voy', style: 'destructive', onPress: () => void ejecutarSalir() },
      ]
    )
  }

  /**
   * RN-029b: "Me sumo". El check-in va por la cola offline (se manda antes que el
   * GPS aunque no haya señal); al marcarlo, el efecto de tracking pide permisos y
   * arranca el GPS.
   */
  const sumarmeAlViaje = async () => {
    if (!viajeId || !userId.trim()) return
    setSumandome(true)
    try {
      await registrarCheckIn(viajeId, userId.trim())
      setCheckInLocal(true)
      void obtenerViaje(viajeId, userId)
        .then(setViaje)
        .catch(() => {
          /* sin señal: el check-in local alcanza hasta que vuelva la red */
        })
    } catch (e) {
      meshAlert('No se pudo sumarte al viaje', mensajeDeError(e))
    } finally {
      setSumandome(false)
    }
  }

  const ejecutarSalir = async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    try {
      await salirViaje(viajeId, userId)
      await detenerTrackingViaje()
      // A diferencia de finalizar, acá no vamos al resumen: el viaje sigue en curso
      // para el resto y el backend devolvería 409. Lo verá desde "Finalizados"
      // cuando el líder lo cierre.
      router.replace('/(tabs)')
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo salir del viaje')
      setAccion(false)
    }
  }

  /** US1: posición para la parada. Reusa `myPosition` (ya mantenida en vivo por el
   * tracking) en vez de pedir una lectura GPS aislada; solo pide una nueva si
   * todavía no hay ninguna posición conocida. */
  const posicionActual = async (): Promise<{ lat: number; lng: number } | null> => {
    if (myPosition) return myPosition
    try {
      const cfg = trackingConfigPorActividad(viaje?.tipo_actividad ?? 'otro')
      const pos = await Location.getCurrentPositionAsync({ accuracy: cfg.accuracy })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      return null
    }
  }

  const handleDetenerse = () => setEligiendoCategoria(true)

  const handleCategoriaElegida = (categoria: CategoriaParadaApi, grupal: boolean) => {
    setEligiendoCategoria(false)
    void (async () => {
      const pos = await posicionActual()
      if (!pos) {
        meshAlert(
          'Sin ubicación',
          'No pudimos obtener tu posición para registrar la parada. Revisá los permisos de ubicación.'
        )
        return
      }
      try {
        await registrarParada(categoria, pos, grupal)
      } catch (e) {
        meshAlert('No se pudo registrar la parada', mensajeDeError(e))
      }
    })()
  }

  /** US3 */
  const handleRetomar = () => {
    void (async () => {
      try {
        await retomarViaje()
      } catch (e) {
        meshAlert('No se pudo retomar', mensajeDeError(e))
      }
    })()
  }

  /** RN-036: confirma que estás bien tras un posible incidente detectado por el sistema. */
  const handleEstoyBien = () => {
    void (async () => {
      try {
        await confirmarBien()
      } catch (e) {
        meshAlert('No se pudo confirmar', mensajeDeError(e))
      }
    })()
  }

  /** RN-036: avisa al grupo que no está bien. Volver a tocar deshace, con confirmación. */
  const handleEstoyMal = () => {
    if (paradaActiva?.necesita_ayuda) {
      meshConfirmDestructive({
        title: '¿Deshacer el pedido de ayuda?',
        message: 'Le vamos a avisar al grupo que cancelaste el aviso.',
        confirmLabel: 'Deshacer',
        cancelLabel: 'Seguir pidiendo ayuda',
        onConfirm: async () => {
          try {
            await deshacerMal()
          } catch (e) {
            meshAlert('No se pudo deshacer', mensajeDeError(e))
          }
        },
      })
      return
    }
    void (async () => {
      try {
        await confirmarMal()
      } catch (e) {
        meshAlert('No se pudo avisar al grupo', mensajeDeError(e))
      }
    })()
  }

  /** US2 */
  const handleSolicitar = () => {
    if (miSolicitud?.estado === 'pendiente') {
      meshAlert(
        'Solicitud enviada',
        'El líder todavía no respondió tu pedido de parada. Te avisamos apenas lo haga.'
      )
      return
    }
    void (async () => {
      const pos = await posicionActual()
      try {
        await pedirParada({ lat: pos?.lat, lng: pos?.lng })
      } catch (e) {
        meshAlert('No se pudo enviar', mensajeDeError(e))
      }
    })()
  }

  const handleSeguirParada = () => {
    void (async () => {
      const activa = await activarSeguirParada()
      if (!activa || !myPosition) return
      // Encuadre deliberado entre vos y la parada: como un arrastre manual,
      // pausa el modo "seguirme" para que no se pise con el próximo tick de posición.
      setSiguiendo(false)
      mapRef.current?.fitBoundsToCoords([
        [myPosition.lat, myPosition.lng],
        [activa.lat, activa.lng],
      ])
    })()
  }

  const handleResponderSolicitud = (
    solicitudId: string,
    decision: 'aprobada' | 'rechazada'
  ) => {
    void (async () => {
      try {
        await responderSolicitud(solicitudId, decision)
      } catch (e) {
        meshAlert('No se pudo responder', mensajeDeError(e))
      }
    })()
  }

  // US2: el solicitante ve el resultado apenas el líder responde.
  useEffect(() => {
    if (!miSolicitud || miSolicitud.estado === 'pendiente') return
    if (miSolicitud.estado === 'cancelada') {
      descartarResultado()
      return
    }
    meshAlert(
      miSolicitud.estado === 'aprobada' ? 'Parada aprobada' : 'Parada rechazada',
      miSolicitud.estado === 'aprobada'
        ? 'El líder aprobó tu solicitud de parada.'
        : 'El líder rechazó tu solicitud de parada.',
      [{ text: 'Entendido', onPress: descartarResultado }]
    )
  }, [miSolicitud, descartarResultado])

  /** US1: la alerta solo lleva ubicación si el autor marcó un punto en el mapa. */
  const handlePublicarAlerta = (
    tipo: TipoAlertaApi,
    mensaje: string,
    ubicacion?: { lat: number; lng: number }
  ) => {
    void (async () => {
      try {
        await publicarAlerta({
          tipo,
          mensaje: mensaje.trim() || undefined,
          lat: ubicacion?.lat,
          lng: ubicacion?.lng,
        })
        setComponiendoAlerta(false)
      } catch (e) {
        meshAlert('No se pudo enviar la alerta', mensajeDeError(e))
      }
    })()
  }

  const irAAlertas = () =>
    router.push({ pathname: '/viaje/[viajeId]/alertas', params: { viajeId: viajeId ?? '' } })

  /** Los flotantes arrancan bajo el header compacto y se corren si hay banners visibles. */
  const TOP_OVERLAYS = insets.top + ALTO_HEADER_COMPACTO
  const topFlotantes = TOP_OVERLAYS + (altoBanners > 0 ? altoBanners + 10 : 0)
  // Sin medir, el botón de centrar quedaba debajo de la botonera al aparecer
  // la fila de paradas.
  const incidentePropio = paradaActiva?.tipo === 'incidente_detectado'

  // Todas las actividades vibran y el patrón depende de la gravedad;
  // trekking/running además lo repiten (RN-052).
  useHapticaAlEntrar(
    alertaEntrante?.id ?? null,
    tipoActividad,
    alertaEntrante ? gravedadAlerta(alertaEntrante.tipo) : 'importante'
  )
  useHapticaAlEntrar(paradaEntrante?.paradaId ?? null, tipoActividad, 'importante')
  useHapticaAlEntrar(llego ? 'llegada' : null, tipoActividad, 'exito')
  // Solicitudes de parada: al líder cuando entra una, al solicitante cuando se resuelve.
  useHapticaAlEntrar(
    esLider ? (pendientes[0]?.solicitudId ?? null) : null,
    tipoActividad,
    'importante'
  )
  useHapticaAlEntrar(
    miSolicitud && (miSolicitud.estado === 'aprobada' || miSolicitud.estado === 'rechazada')
      ? `${miSolicitud.id}:${miSolicitud.estado}`
      : null,
    tipoActividad,
    'importante'
  )
  // "¿Estás bien?": insiste cada 5 s hasta que la persona responde.
  useHapticaCriticaRepetida(incidentePropio && !paradaActiva?.necesita_ayuda)

  // Con esta pantalla abierta los avisos del viaje ya se ven y vibran acá:
  // la push del mismo viaje no vuelve a sonar.
  useEffect(() => {
    if (!viajeId) return
    marcarViajeEnPantalla(viajeId)
    return () => marcarViajeEnPantalla(null)
  }, [viajeId])
  const bottomCentrar = (altoBotonera || 130) + 12
  const extraIncidente = incidentePropio ? 236 : 0
  const altoFlotantesInferiores = Math.round(48 * uiConfig.escalaBotones)
  // Los botones de centrar y de ayuda acompañan al panel inferior mientras se
  // arrastra: antes se reubicaban recién al soltar y quedaban colgados en el medio.
  const estiloFlotantesInferiores = useAnimatedStyle(() => {
    const sobrePanel =
      topPanel.value >= 0 && altoRaiz > 0 ? altoRaiz - topPanel.value + 12 : bottomCentrar
    return { transform: [{ translateY: -(sobrePanel + extraIncidente) }] }
  }, [altoRaiz, bottomCentrar, extraIncidente])

  /** Reactiva el modo "seguirme" y centra ya mismo con la posición que ya tenemos
   * en memoria — sin pedir una lectura GPS nueva y aislada. */
  const handleCenterOnMe = () => {
    setSiguiendo(true)
    if (myPosition) mapRef.current?.panTo(myPosition.lat, myPosition.lng)
  }

  if (!viajeId) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>Viaje no especificado.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <View
      style={[styles.root, { backgroundColor: theme.background }]}
      onLayout={(e) => setAltoRaiz(e.nativeEvent.layout.height)}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={uiConfig.pantallaCompleta} />
      <PasoAyuda {...AYUDA_VIAJE_LIVE[0]!} estilo={styles.flex1}>
        <LiveMapView
          ref={mapRef}
          routeRemaining={routeLine}
          rutaCompleta={routeLine}
          avanceM={avance?.progresoM ?? null}
          meta={meta}
          movimientoFluido
          siguiendo={siguiendo}
          breadcrumb={breadcrumb}
          members={memberList}
          alertasEnMapa={alertasEnMapa}
          guiaParada={guiaParada}
          guiaAlerta={guiaAlerta}
          guiaLugar={guiaLugar}
          fantasma={
            fantasma
              ? { ...fantasma.posicion, nombre: fantasma.nombre, pausado: fantasma.pausado, traza: fantasma.traza }
              : null
          }
          currentUserId={userId}
          initialCenter={initialCenter}
          mapStyle={mapStyle}
          onUserDrag={() => setSiguiendo(false)}
        />
      </PasoAyuda>

      <PasoAyuda
        {...AYUDA_VIAJE_LIVE[1]!}
        estilo={[StyleSheet.absoluteFill, styles.zIndexEncabezado]}
        pointerEvents="box-none"
      >
        <LiveTripHeader
          tripName={tripDisplayName}
          nextStop={nextStop}
          hasRoute={routeStops.length > 0}
          members={liveMembers}
          currentUserId={userId}
          onBack={() => router.back()}
          onExpandedChange={setHeaderExpandido}
          tipoActividad={tipoActividad}
        />
      </PasoAyuda>


      {/* Pila de banners: se apilan solos y su alto real corre a los botones
          flotantes, que antes quedaban tapados debajo de estos avisos. */}
      <View
        style={[styles.bannerStack, { top: TOP_OVERLAYS + 6 }]}
        pointerEvents="box-none"
        onLayout={(e) => setAltoBanners(e.nativeEvent.layout.height)}
      >
        {fg === false ? (
          <View style={[styles.warnBanner, { backgroundColor: theme.dangerWeak }]}>
            <Text style={[styles.warnTxt, { color: theme.danger, fontSize: tamanoOutdoor(13) }]}>
              Ubicación desconocida: tu posición no se compartirá hasta que otorgues permisos.
            </Text>
          </View>
        ) : null}

        {__DEV__ && Platform.OS === 'ios' && API_BASE_URL.includes('localhost') ? (
          <View style={[styles.infoBanner, { backgroundColor: theme.accentWeak }]}>
            <Text style={[styles.infoTxt, { color: theme.text, fontSize: tamanoOutdoor(12) }]}>
              iOS no puede usar localhost. Agregá EXPO_PUBLIC_API_URL=http://IP_PC:3000 en .env
            </Text>
          </View>
        ) : null}

        {permiteComparar && viaje?.modo === 'competitivo' ? (
          <LeaderboardPanel filas={leaderboard} currentUserId={userId} />
        ) : null}

        {fantasma ? (
          <FantasmaPanel fantasma={fantasma} onPausar={pausarFantasma} onQuitar={quitarFantasma} />
        ) : null}

        {llegada ? (
          <LlegadaDestinoBanner
            destinoNombre={destinoNombre}
            esCreador={esLider}
            ocupado={accion}
            onContinuar={descartarLlegada}
            onFinalizar={esLider ? confirmarFinalizar : undefined}
            onSalir={!esLider ? confirmarSalir : undefined}
          />
        ) : null}

        {paradaEntrante ? (
          <ParadaVoluntariaBanner
            nombre={paradaEntrante.nombre}
            motivo={motivoParadaLegible(paradaEntrante.categoria)}
            restantes={paradasEntrantes.length}
            ocupado={calculandoSeguir}
            grupal={paradaEntrante.grupal}
            onSeguir={handleSeguirParada}
            onIgnorar={ignorarParadaEntrante}
          />
        ) : null}

        {esLider && pendientes.length > 0 && pendientes[0] ? (
          <SolicitudParadaBanner
            nombre={pendientes[0].nombre}
            motivo={pendientes[0].motivo}
            restantes={pendientes.length}
            ocupado={paradaEnCurso}
            onAprobar={() => handleResponderSolicitud(pendientes[0]!.solicitudId, 'aprobada')}
            onRechazar={() => handleResponderSolicitud(pendientes[0]!.solicitudId, 'rechazada')}
          />
        ) : null}
      </View>

      {!headerExpandido ? (
        <>
          <PasoAyuda
            {...AYUDA_VIAJE_LIVE[2]!}
            estilo={[StyleSheet.absoluteFill, styles.zIndexAlertas]}
            pointerEvents="box-none"
          >
            <AlertasButton
              cantidad={alertasNoVistas}
              topOffset={topFlotantes + 14}
              onPress={irAAlertas}
              onCrear={puedeCrearAlertas ? () => setComponiendoAlerta(true) : undefined}
              onFantasma={permiteComparar ? () => setEligiendoFantasma(true) : undefined}
              fantasmaActivo={fantasmaActivo}
              tipoActividad={tipoActividad}
            />
          </PasoAyuda>

          <MapStylePicker value={mapStyle} onChange={setMapStyle} topAbsolute={topFlotantes + 14} light />

          {viaje?.estado === 'en_curso' ? (
            <CercaMioButton
              topOffset={topFlotantes + 14 + 44 + 10}
              guiaActiva={guiaLugar != null}
              onPress={() => (guiaLugar ? setGuiaLugar(null) : setBuscandoCerca(true))}
              tipoActividad={tipoActividad}
            />
          ) : null}
        </>
      ) : null}

      <Animated.View
        style={[styles.flotantesInferiores, { height: altoFlotantesInferiores }, estiloFlotantesInferiores]}
        pointerEvents="box-none"
      >
        <BotonAyuda
          altoContraste={uiConfig.altoContraste}
          size={Math.round(44 * uiConfig.escalaBotones)}
          style={styles.botonAyudaLive}
        />
        <CenterLocationButton
          onPress={handleCenterOnMe}
          bottomOffset={0}
          siguiendo={siguiendo}
          tipoActividad={tipoActividad}
        />
      </Animated.View>

      {incidentePropio && paradaActiva ? (
        <EstoyBienBanner
          paradaDesde={paradaActiva.inicio}
          ocupado={paradaEnCurso || !!accion}
          bottomOffset={bottomCentrar}
          onConfirmar={handleEstoyBien}
          necesitaAyuda={Boolean(paradaActiva.necesita_ayuda)}
          onEstoyMal={handleEstoyMal}
        />
      ) : null}

      {/* RN-029b: confirmó pero todavía no se sumó. Ve el mapa, pero no se lo trackea
          ni puede operar en vivo hasta que elija. */}
      {viaje?.estado === 'en_curso' && !sumado ? (
        <View
          style={[
            styles.sumarseCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
        >
          <Text style={[styles.sumarseTitulo, { color: theme.text, fontSize: tamanoOutdoor(18) }]}>
            El viaje está en curso
          </Text>
          <Text style={[styles.sumarseTexto, { color: theme.textDim, fontSize: tamanoOutdoor(15) }]}>
            Tu ubicación no se comparte hasta que te sumes. Si no vas a ir, avisale al grupo.
          </Text>
          <ScrollView style={styles.sumarseAviso}>
            <AvisoUbicacion />
          </ScrollView>
          <Btn
            variant="primary"
            block
            size="lg"
            onPress={() => void sumarmeAlViaje()}
            loading={sumandome}
            disabled={sumandome || !!accion}
          >
            Acepto y me sumo
          </Btn>
          <Btn
            variant="ghost"
            block
            size="lg"
            onPress={confirmarSalir}
            disabled={sumandome || !!accion}
          >
            No voy a ir
          </Btn>
        </View>
      ) : (
      <PasoAyuda {...AYUDA_VIAJE_LIVE[3]!} estilo={StyleSheet.absoluteFill} pointerEvents="box-none">
        <LiveBottomPanel
          elapsedLabel={elapsedLabel}
          distanceLabel={distanceLabel}
          entrenamiento={entrenamientoEnVivo}
          proximaParada={viaje?.estado === 'en_curso' ? nextStop : null}
          enCurso={viaje?.estado === 'en_curso'}
          esLider={esLider}
          accion={!!accion}
          paradaDesde={paradaActiva?.inicio ?? null}
          esIncidenteDetectado={paradaActiva?.tipo === 'incidente_detectado'}
          retomaElGrupo={esLider && Boolean(paradaActiva?.grupal)}
          puedeSolicitar={puedeSolicitarParada}
          solicitudPendiente={miSolicitud?.estado === 'pendiente'}
          paradaEnCurso={paradaEnCurso}
          onDetenerse={handleDetenerse}
          onRetomar={handleRetomar}
          onEstoyBien={handleEstoyBien}
          onSolicitar={handleSolicitar}
          onFinalizar={confirmarFinalizar}
          onSalir={confirmarSalir}
          onGastos={
            puedeGastos
              ? () => router.push({ pathname: '/viaje/[viajeId]/gastos', params: { viajeId: viajeId ?? '' } })
              : undefined
          }
          onAjustes={puedeAjustar ? () => setAjustando(true) : undefined}
          onHeightChange={setAltoBotonera}
          posicionAnimada={topPanel}
          tipoActividad={tipoActividad}
        />
      </PasoAyuda>
      )}

      {/* La alerta entrante va en su propia capa, arriba de todo (header,
          banners, botones flotantes): es lo primero que tiene que verse. */}
      {alertaEntrante ? (
        <View style={[styles.alertaCapa, { top: insets.top + 8 }]} pointerEvents="box-none">
          <AlertaGrupalBanner
            alerta={alertaEntrante}
            restantes={alertasEntrantes.length}
            ocupado={calculandoSeguirAlerta}
            onSeguir={() => void activarSeguirAlerta()}
            onIgnorar={ignorarAlertaEntrante}
          />
        </View>
      ) : null}

      <CategoriaParadaSheet
        visible={eligiendoCategoria}
        onSeleccionar={handleCategoriaElegida}
        onCancelar={() => setEligiendoCategoria(false)}
        puedeDetenerGrupo={esLider && viaje?.es_grupal === true}
        tipoActividad={tipoActividad}
      />

      <LugaresSugeridosModal
        visible={buscandoCerca}
        titulo="Cerca mío"
        subtitulo="Lugares a menos de 5 km"
        accionLabel="Ir"
        buscar={buscarCercaMio}
        detalle={distanciaHastaLugar}
        onElegir={(lugar) => void irALugar(lugar)}
        onCerrar={() => setBuscandoCerca(false)}
      />

      <FantasmaPickerModal
        visible={eligiendoFantasma}
        viajeId={viajeId}
        ocupado={cargandoFantasma}
        onElegir={handleElegirFantasma}
        onCerrar={() => setEligiendoFantasma(false)}
      />

      {viaje && puedeAjustar ? (
        <AjustesViajeSheet
          visible={ajustando}
          viaje={viaje}
          userId={userId}
          onActualizado={(a) => setViaje((prev) => (prev ? { ...prev, ...a } : prev))}
          onCerrar={() => setAjustando(false)}
        />
      ) : null}

      <CrearAlertaSheet
        visible={componiendoAlerta}
        enviando={alertaEnviando}
        centroMapaInicial={centroMapaAlerta}
        onPublicar={handlePublicarAlerta}
        onCancelar={() => setComponiendoAlerta(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sumarseCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 10,
  },
  sumarseTitulo: {
    fontWeight: '800',
  },
  sumarseTexto: {
    lineHeight: 22,
  },
  sumarseAviso: {
    maxHeight: 140,
  },
  flex1: {
    flex: 1,
  },
  zIndexEncabezado: {
    zIndex: 50,
  },
  zIndexAlertas: {
    zIndex: 20,
  },
  flotantesInferiores: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  botonAyudaLive: {
    position: 'absolute',
    right: 16,
    bottom: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: '#6b7280',
    fontSize: 15,
  },
  bannerStack: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 30,
  },
  alertaCapa: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    elevation: 100,
  },
  warnBanner: {
    padding: 10,
    borderRadius: 10,
  },
  warnTxt: {
    fontSize: 13,
  },
  infoBanner: {
    padding: 8,
    borderRadius: 8,
  },
  infoTxt: {
    fontSize: 12,
  },
})
