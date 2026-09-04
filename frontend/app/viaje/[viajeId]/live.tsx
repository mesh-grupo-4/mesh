import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { meshAlert } from '@/lib/meshAlert';

import { AlertaGrupalBanner } from '@/components/live/AlertaGrupalBanner'
import { AlertasButton } from '@/components/live/AlertasButton'
import { CategoriaParadaSheet } from '@/components/live/CategoriaParadaSheet'
import { CrearAlertaSheet } from '@/components/live/CrearAlertaSheet'
import { CenterLocationButton } from '@/components/live/CenterLocationButton'
import { ParadaVoluntariaBanner } from '@/components/live/ParadaVoluntariaBanner'
import { SolicitudParadaBanner } from '@/components/live/SolicitudParadaBanner'
import { LlegadaDestinoBanner } from '@/components/live/LlegadaDestinoBanner'
import { EstoyBienBanner } from '@/components/live/EstoyBienBanner'
import { LiveBottomPanel } from '@/components/live/LiveBottomPanel'
import { LiveMapView, type LiveMapViewHandle } from '@/components/live/LiveMapView'
import type { LiveMember } from '@/components/live/LiveMembersBar'
import { LiveTripHeader } from '@/components/live/LiveTripHeader'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import type { MapStyleId } from '@/components/route-config/mapStyles'
import { useTheme } from '@/components/MeshUI'
import { DEV_USER_ID, API_BASE_URL } from '@/constants/Config'
import { tamanoOutdoor } from '@/constants/Typography'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumbTrail } from '@/hooks/useBreadcrumbTrail'
import { useLiveLocations } from '@/hooks/useLiveLocations'
import { useLlegadaDestino } from '@/hooks/useLlegadaDestino'
import { useAlertas } from '@/hooks/useAlertas'
import { useParadas } from '@/hooks/useParadas'
import { useNextStopEta } from '@/hooks/useNextStopEta'
import { useTripMetrics } from '@/hooks/useTripMetrics'
import { uiConfigPorActividad } from '@/lib/activityUi'
import type { RouteStop } from '@/lib/geo/nextStop'
import { dividirRutaPorAvance } from '@/lib/geo/routeProgress'
import { useHapticaAlEntrar } from '@/lib/haptics'
import { nombreCompleto } from '@/lib/nombres'
import type { TipoAlertaApi } from '@/lib/alertasApi'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { motivoParadaLegible } from '@/lib/paradasApi'
import { linestringToLatLng, waypointsFromRutaDetalle } from '@/lib/routePayload'
import { connectMeshSocket } from '@/lib/meshSocket'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  detenerTrackingViaje,
  iniciarTrackingViaje,
  solicitarPermisosUbicacion,
} from '@/lib/tracking/trackingControl'
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

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
}

function duracionLegible(segundos: number): string {
  if (segundos < 60) return `${segundos} s`
  const min = Math.floor(segundos / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h} h ${resto} min` : `${h} h`
}

export default function ViajeLiveScreen() {
  const router = useRouter()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()
  const mapRef = useRef<LiveMapViewHandle>(null)

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
  const [initialCenter, setInitialCenter] = useState<{ latitude: number; longitude: number } | null>(
    null
  )
  const [gpsCenterFailed, setGpsCenterFailed] = useState(false)
  /** Modo "seguirme": el mapa se recentra solo mientras es true; se pausa si el usuario arrastra a mano. */
  const [siguiendo, setSiguiendo] = useState(true)
  const [fg, setFg] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyleId>('standard')
  const [headerExpandido, setHeaderExpandido] = useState(false)
  const [accion, setAccion] = useState(false)
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false)
  const [componiendoAlerta, setComponiendoAlerta] = useState(false)
  /** Alto real de la pila de banners: los botones flotantes se corren debajo. */
  const [altoBanners, setAltoBanners] = useState(0)
  /** Alto real de la botonera inferior, que creció con la fila de paradas. */
  const [altoBotonera, setAltoBotonera] = useState(0)

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

  const { memberList, staleByUserId, realtimeOk } = useLiveLocations({
    viajeId: viajeId ?? '',
    userId,
    nameByUserId,
    selfSeed: initialCenter ? { lat: initialCenter.latitude, lng: initialCenter.longitude } : null,
  })

  const myPosition = useMemo(() => {
    const me = memberList.find((m) => m.usuarioId === userId)
    if (me) return { lat: me.lat, lng: me.lng }
    if (initialCenter) return { lat: initialCenter.latitude, lng: initialCenter.longitude }
    return null
  }, [memberList, userId, initialCenter])

  // Modo "seguirme": recentra (sin tocar el zoom) cada vez que se actualiza tu
  // posición, mientras `siguiendo` esté activo. Se pausa solo al arrastrar el
  // mapa a mano (`onUserDrag`, ver más abajo) y se reactiva con el botón centrar.
  useEffect(() => {
    if (!siguiendo || !myPosition) return
    mapRef.current?.panTo(myPosition.lat, myPosition.lng)
  }, [siguiendo, myPosition])

  const nextStop = useNextStopEta({
    currentPos: myPosition,
    stops: routeStops,
    speedKmh: viaje?.velocidad_esperada ?? 30,
  })

  const liveMembers = useMemo((): LiveMember[] => {
    const seen = new Set<string>()
    const list: LiveMember[] = []
    const onMap = new Set(memberList.map((m) => m.usuarioId))

    const add = (id: string, nombre: string) => {
      if (seen.has(id)) return
      seen.add(id)
      list.push({ id, nombre, enMapa: onMap.has(id), sinSenal: staleByUserId[id] === true })
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
  }, [viaje, participantes, memberList, staleByUserId])

  const tripDisplayName = useMemo(() => {
    if (viaje?.nombre?.trim()) return viaje.nombre.trim()
    return viaje?.es_grupal ? 'Salida grupal' : 'Salida individual'
  }, [viaje])

  const esLider = viaje != null && userId === viaje.creador_id

  // RN-052: interfaz adaptativa por actividad (pantalla completa/alto contraste en
  // moto, botones grandes, háptica prioritaria en trekking/running).
  const tipoActividad = (viaje?.tipo_actividad ?? 'otro') as TipoActividadApi
  const uiConfig = uiConfigPorActividad(tipoActividad)
  const theme = useTheme(uiConfig.altoContraste)

  // Solo tiene sentido pedirle una parada al líder si hay líder distinto de uno
  // mismo y el viaje es grupal: en una salida individual no hay a quién pedirle.
  const puedeSolicitarParada = viaje != null && viaje.es_grupal && !esLider

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

  const puedeCrearAlertas =
    viaje?.estado === 'en_curso' &&
    (esLider || (viaje?.alertas_solo_lider ?? true) === false)

  const centroMapaAlerta = useMemo(() => {
    if (myPosition) return { latitude: myPosition.lat, longitude: myPosition.lng }
    if (initialCenter) return initialCenter
    return { latitude: -31.4167, longitude: -64.1833 }
  }, [myPosition, initialCenter])

  const { elapsedLabel, distanceLabel } = useTripMetrics({
    viajeId: viajeId ?? '',
    userId,
    fechaInicioReal: viaje?.fecha_inicio_real ?? null,
    tipoActividad: viaje?.tipo_actividad ?? 'otro',
  })

  const breadcrumb = useBreadcrumbTrail({
    viajeId: viajeId ?? '',
    userId,
    tipoActividad: viaje?.tipo_actividad ?? 'otro',
    habilitado: viaje?.estado === 'en_curso',
  })

  const destino = useMemo(() => {
    const fin = routeStops.find((s) => s.type === 'DESTINATION')
    if (!fin) return null
    return { lat: fin.lat, lng: fin.lng, nombre: fin.name ?? null }
  }, [routeStops])

  const routeRemaining = useMemo(() => {
    if (!routeLine?.length || !myPosition) return routeLine
    return dividirRutaPorAvance(routeLine, myPosition).restante
  }, [routeLine, myPosition])

  const alertasEnMapa = useMemo(
    () => alertas.filter((a) => a.estado === 'activa' && a.lat != null && a.lng != null),
    [alertas]
  )

  const { llegada, descartar: descartarLlegada, destinoNombre } = useLlegadaDestino({
    destino,
    pos: myPosition,
    habilitado: viaje?.estado === 'en_curso',
  })

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
        if (ruta?.linestring) {
          setRouteLine(linestringToLatLng(ruta.linestring))
          const h = waypointsFromRutaDetalle(ruta)
          const stops: RouteStop[] = [
            { lat: h.origen.lat, lng: h.origen.lon, name: h.origen.name || 'Origen', type: 'ORIGIN' },
            ...h.paradas.map((p) => ({
              lat: p.lat,
              lng: p.lon,
              name: p.name || 'Parada',
              type: 'STOP' as const,
            })),
            {
              lat: h.destino.lat,
              lng: h.destino.lon,
              name: h.destino.name || 'Destino',
              type: 'DESTINATION',
            },
          ]
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
      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      const onFin = (payload: { viajeId: string }) => {
        if (payload.viajeId !== viajeId) return
        void detenerTrackingViaje()
        // El líder que finalizó maneja su propia navegación en ejecutarFinalizar.
        if (finalizandoRef.current) return
        // Para participantes: salir del mapa y mostrarles el resumen.
        router.replace({ pathname: '/viaje/[viajeId]/resumen', params: { viajeId } })
      }

      const onSalio = (payload: { viajeId: string; usuarioId: string }) => {
        if (payload.viajeId !== viajeId) return
        setParticipantes((prev) =>
          prev.map((p) =>
            p.usuario.id === payload.usuarioId ? { ...p, estado: 'salido' as const } : p
          )
        )
      }

      sock.on('viaje:finalizado', onFin)
      sock.on('viaje:participante_salio', onSalio)
      cleanup = () => {
        sock.off('viaje:finalizado', onFin)
        sock.off('viaje:participante_salio', onSalio)
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
      const perm = await solicitarPermisosUbicacion()
      if (cancelled) return
      setFg(perm.foreground)
      if (perm.foreground) {
        await iniciarTrackingViaje(viajeId, userId.trim(), viaje.tipo_actividad)
      }
      try {
        const cfg = trackingConfigPorActividad(viaje.tipo_actividad)
        const pos = await Location.getCurrentPositionAsync({ accuracy: cfg.accuracy })
        if (!cancelled) {
          setInitialCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        }
      } catch {
        if (!cancelled) setGpsCenterFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viajeId, userId, viaje?.tipo_actividad])

  // Fallback: si el GPS no resolvió una posición, centramos en el origen de la ruta.
  useEffect(() => {
    if (!gpsCenterFailed || initialCenter || !routeLine?.[0]) return
    const [lat, lng] = routeLine[0]
    setInitialCenter({ latitude: lat, longitude: lng })
  }, [gpsCenterFailed, initialCenter, routeLine])

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
    meshAlert(
      'Salir del viaje',
      '¿Estás seguro? Dejarás de compartir tu ubicación con el grupo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => void ejecutarSalir() },
      ]
    )
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

  const handleCategoriaElegida = (categoria: CategoriaParadaApi) => {
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
        await registrarParada(categoria, pos)
      } catch (e) {
        meshAlert('No se pudo registrar la parada', mensajeDeError(e))
      }
    })()
  }

  /** US3 */
  const handleRetomar = () => {
    void (async () => {
      try {
        const parada = await retomarViaje()
        const seg = parada.duracion_segundos ?? 0
        meshAlert('Retomaste el viaje', `Parada de ${duracionLegible(seg)} registrada.`)
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
        meshAlert('Confirmado', 'Volviste a figurar en movimiento en el mapa del grupo.')
      } catch (e) {
        meshAlert('No se pudo confirmar', mensajeDeError(e))
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
        meshAlert('Solicitud enviada', 'El líder recibió tu pedido de parada.')
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
  const TOP_OVERLAYS = 96
  const topFlotantes = TOP_OVERLAYS + (altoBanners > 0 ? altoBanners + 10 : 0)
  // Sin medir, el botón de centrar quedaba debajo de la botonera al aparecer
  // la fila de paradas.
  const incidentePropio = paradaActiva?.tipo === 'incidente_detectado'

  // Trekking/running priorizan la vibración sobre mirar la pantalla (RN-052).
  useHapticaAlEntrar(Boolean(alertaEntrante), tipoActividad, 'alerta')
  useHapticaAlEntrar(Boolean(paradaEntrante), tipoActividad, 'alerta')
  useHapticaAlEntrar(Boolean(llegada), tipoActividad, 'exito')
  useHapticaAlEntrar(incidentePropio, tipoActividad, 'alerta')
  const bottomCentrar = (altoBotonera || 130) + 12
  const bottomCentrarMapa = bottomCentrar + (incidentePropio ? 168 : 0)

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
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={uiConfig.pantallaCompleta} />
      <LiveMapView
        ref={mapRef}
        routeRemaining={routeRemaining}
        breadcrumb={breadcrumb}
        members={memberList}
        alertasEnMapa={alertasEnMapa}
        guiaParada={guiaParada}
        guiaAlerta={guiaAlerta}
        currentUserId={userId}
        initialCenter={initialCenter}
        mapStyle={mapStyle}
        onUserDrag={() => setSiguiendo(false)}
      />

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

      {/* Pila de banners: se apilan solos y su alto real corre a los botones
          flotantes, que antes quedaban tapados debajo de estos avisos. */}
      <View
        style={styles.bannerStack}
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

        {!realtimeOk && isSupabaseConfigured() ? (
          <View style={[styles.infoBanner, { backgroundColor: theme.accentWeak }]}>
            <Text style={[styles.infoTxt, { color: theme.text, fontSize: tamanoOutdoor(12) }]}>
              Realtime Supabase desconectado; usamos WebSocket y refresco cada 15 s.
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

        {alertaEntrante ? (
          <AlertaGrupalBanner
            alerta={alertaEntrante}
            restantes={alertasEntrantes.length}
            ocupado={calculandoSeguirAlerta}
            onSeguir={() => void activarSeguirAlerta()}
            onIgnorar={ignorarAlertaEntrante}
          />
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
          <AlertasButton
            cantidad={alertas.length}
            topOffset={topFlotantes + 14}
            onPress={irAAlertas}
            onCrear={puedeCrearAlertas ? () => setComponiendoAlerta(true) : undefined}
            tipoActividad={tipoActividad}
          />

          <MapStylePicker value={mapStyle} onChange={setMapStyle} topAbsolute={topFlotantes + 14} light />
        </>
      ) : null}

      <CenterLocationButton
        onPress={handleCenterOnMe}
        bottomOffset={bottomCentrarMapa}
        siguiendo={siguiendo}
        tipoActividad={tipoActividad}
      />

      {incidentePropio && paradaActiva ? (
        <EstoyBienBanner
          paradaDesde={paradaActiva.inicio}
          ocupado={paradaEnCurso || !!accion}
          bottomOffset={bottomCentrar}
          onConfirmar={handleEstoyBien}
        />
      ) : null}

      <LiveBottomPanel
        elapsedLabel={elapsedLabel}
        distanceLabel={distanceLabel}
        enCurso={viaje?.estado === 'en_curso'}
        esLider={esLider}
        accion={!!accion}
        paradaDesde={paradaActiva?.inicio ?? null}
        esIncidenteDetectado={paradaActiva?.tipo === 'incidente_detectado'}
        puedeSolicitar={puedeSolicitarParada}
        solicitudPendiente={miSolicitud?.estado === 'pendiente'}
        paradaEnCurso={paradaEnCurso}
        onDetenerse={handleDetenerse}
        onRetomar={handleRetomar}
        onEstoyBien={handleEstoyBien}
        onSolicitar={handleSolicitar}
        onFinalizar={confirmarFinalizar}
        onSalir={confirmarSalir}
        onHeightChange={setAltoBotonera}
        tipoActividad={tipoActividad}
      />

      <CategoriaParadaSheet
        visible={eligiendoCategoria}
        onSeleccionar={handleCategoriaElegida}
        onCancelar={() => setEligiendoCategoria(false)}
        tipoActividad={tipoActividad}
      />

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
    top: 96,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 30,
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
