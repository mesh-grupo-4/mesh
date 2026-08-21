import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { meshAlert } from '@/lib/meshAlert';

import { AlertaBanner } from '@/components/live/AlertaBanner'
import { AlertasButton } from '@/components/live/AlertasButton'
import { CategoriaParadaSheet } from '@/components/live/CategoriaParadaSheet'
import { CrearAlertaSheet } from '@/components/live/CrearAlertaSheet'
import { CenterLocationButton } from '@/components/live/CenterLocationButton'
import { ParadaActionsBar } from '@/components/live/ParadaActionsBar'
import { SolicitudParadaBanner } from '@/components/live/SolicitudParadaBanner'
import { LiveMapView, type LiveMapViewHandle } from '@/components/live/LiveMapView'
import type { LiveMember } from '@/components/live/LiveMembersBar'
import { LiveTripHeader } from '@/components/live/LiveTripHeader'
import { TripMetricsPanel } from '@/components/live/TripMetricsPanel'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import type { MapStyleId } from '@/components/route-config/mapStyles'
import { DEV_USER_ID, API_BASE_URL } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { useLiveLocations } from '@/hooks/useLiveLocations'
import { useAlertas } from '@/hooks/useAlertas'
import { useParadas } from '@/hooks/useParadas'
import { useNextStopEta } from '@/hooks/useNextStopEta'
import { useTripMetrics } from '@/hooks/useTripMetrics'
import type { RouteStop } from '@/lib/geo/nextStop'
import { nombreCompleto } from '@/lib/nombres'
import type { TipoAlertaApi } from '@/lib/alertasApi'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { linestringToLatLng, waypointsFromRutaDetalle } from '@/lib/routePayload'
import { connectMeshSocket } from '@/lib/meshSocket'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  detenerTrackingViaje,
  iniciarTrackingViaje,
  solicitarPermisosUbicacion,
} from '@/lib/tracking/trackingControl'
import {
  listarParticipantesViaje,
  obtenerRuta,
  obtenerViaje,
  finalizarViaje,
  salirViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
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
  const insets = useSafeAreaInsets()
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
  const [fg, setFg] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyleId>('standard')
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
  })

  const myPosition = useMemo(() => {
    const me = memberList.find((m) => m.usuarioId === userId)
    if (me) return { lat: me.lat, lng: me.lng }
    if (initialCenter) return { lat: initialCenter.latitude, lng: initialCenter.longitude }
    return null
  }, [memberList, userId, initialCenter])

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

  // Solo tiene sentido pedirle una parada al líder si hay líder distinto de uno
  // mismo y el viaje es grupal: en una salida individual no hay a quién pedirle.
  const puedeSolicitarParada = viaje != null && viaje.es_grupal && !esLider

  const {
    paradaActiva,
    miSolicitud,
    pendientes,
    enviando: paradaEnCurso,
    registrarParada,
    retomarViaje,
    pedirParada,
    responderSolicitud,
    descartarResultado,
  } = useParadas({
    viajeId: viajeId ?? '',
    userId,
    esLider,
    habilitado: viaje?.estado === 'en_curso',
  })

  const {
    alertas,
    ultima: ultimaAlerta,
    enviando: alertaEnviando,
    publicar: publicarAlerta,
    descartarUltima,
  } = useAlertas({
    viajeId: viajeId ?? '',
    userId,
    habilitado: Boolean(viajeId && userId.trim()),
  })

  const { elapsedLabel, distanceLabel } = useTripMetrics({
    viajeId: viajeId ?? '',
    userId,
    fechaInicioReal: viaje?.fecha_inicio_real ?? null,
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

      sock.on('viaje:finalizado', onFin)
      cleanup = () => sock.off('viaje:finalizado', onFin)
    })()

    return () => cleanup?.()
  }, [viajeId, userId, router])

  // Permisos, arranque del tracking y centrado inicial en la posición del usuario (AC1).
  // No depende de `routeLine`: hacerlo reiniciaba el GPS cada vez que cargaba la ruta.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!viajeId || !userId.trim() || Platform.OS === 'web') return
      const perm = await solicitarPermisosUbicacion()
      if (cancelled) return
      setFg(perm.foreground)
      if (perm.foreground) {
        await iniciarTrackingViaje(viajeId, userId.trim())
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
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
  }, [viajeId, userId])

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

  /** US1: posición para la parada; si el GPS falla usamos la última conocida. */
  const posicionActual = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      return myPosition
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

  /** US1: la alerta viaja con la posición del líder para ubicarla en el mapa. */
  const handlePublicarAlerta = (tipo: TipoAlertaApi, mensaje: string) => {
    void (async () => {
      const pos = await posicionActual()
      try {
        await publicarAlerta({
          tipo,
          // Vacío = sin mensaje: el tipo ya dice de qué se trata.
          mensaje: mensaje.trim() || undefined,
          lat: pos?.lat,
          lng: pos?.lng,
        })
        setComponiendoAlerta(false)
      } catch (e) {
        meshAlert('No se pudo enviar la alerta', mensajeDeError(e))
      }
    })()
  }

  const irAAlertas = () =>
    router.push({ pathname: '/viaje/[viajeId]/alertas', params: { viajeId: viajeId ?? '' } })

  /** Los flotantes arrancan bajo el header y se corren si hay banners visibles. */
  const TOP_OVERLAYS = 128
  const topFlotantes = TOP_OVERLAYS + (altoBanners > 0 ? altoBanners + 10 : 0)
  // Sin medir, el botón de centrar quedaba debajo de la botonera al aparecer
  // la fila de paradas.
  const bottomCentrar = (altoBotonera || 130) + 12

  const handleCenterOnMe = () => {
    void (async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        mapRef.current?.focusOnCoordinate(pos.coords.latitude, pos.coords.longitude)
      } catch {
        const me = memberList.find((m) => m.usuarioId === userId)
        if (me) mapRef.current?.focusOnCoordinate(me.lat, me.lng)
      }
    })()
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
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LiveMapView
        ref={mapRef}
        routeLineLatLng={routeLine}
        members={memberList}
        currentUserId={userId}
        initialCenter={initialCenter}
        mapStyle={mapStyle}
      />

      <LiveTripHeader
        tripName={tripDisplayName}
        nextStop={nextStop}
        hasRoute={routeStops.length > 0}
        members={liveMembers}
        currentUserId={userId}
        onBack={() => router.back()}
      />

      {/* Pila de banners: se apilan solos y su alto real corre a los botones
          flotantes, que antes quedaban tapados debajo de estos avisos. */}
      <View
        style={styles.bannerStack}
        pointerEvents="box-none"
        onLayout={(e) => setAltoBanners(e.nativeEvent.layout.height)}
      >
        {fg === false ? (
          <View style={styles.warnBanner}>
            <Text style={styles.warnTxt}>
              Ubicación desconocida: tu posición no se compartirá hasta que otorgues permisos.
            </Text>
          </View>
        ) : null}

        {!realtimeOk && isSupabaseConfigured() ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoTxt}>
              Realtime Supabase desconectado; usamos WebSocket y refresco cada 15 s.
            </Text>
          </View>
        ) : null}

        {__DEV__ && Platform.OS === 'ios' && API_BASE_URL.includes('localhost') ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoTxt}>
              iOS no puede usar localhost. Agregá EXPO_PUBLIC_API_URL=http://IP_PC:3000 en .env
            </Text>
          </View>
        ) : null}

        {ultimaAlerta ? (
          <AlertaBanner
            alerta={ultimaAlerta}
            onCerrar={descartarUltima}
            onVerHistorial={() => {
              descartarUltima()
              irAAlertas()
            }}
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

      <AlertasButton
        cantidad={alertas.length}
        topOffset={topFlotantes}
        onPress={irAAlertas}
        onCrear={
          esLider && viaje?.estado === 'en_curso' ? () => setComponiendoAlerta(true) : undefined
        }
      />

      <MapStylePicker value={mapStyle} onChange={setMapStyle} topOffset={topFlotantes} />

      <CenterLocationButton onPress={handleCenterOnMe} bottomOffset={bottomCentrar} />

      <View onLayout={(e) => setAltoBotonera(e.nativeEvent.layout.height)}>
        <TripMetricsPanel elapsedLabel={elapsedLabel} distanceLabel={distanceLabel} />

        {viaje?.estado === 'en_curso' ? (
          <ParadaActionsBar
            paradaDesde={paradaActiva?.inicio ?? null}
            puedeSolicitar={puedeSolicitarParada}
            solicitudPendiente={miSolicitud?.estado === 'pendiente'}
            ocupado={paradaEnCurso || accion}
            onDetenerse={handleDetenerse}
            onRetomar={handleRetomar}
            onSolicitar={handleSolicitar}
          />
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.endBar,
            // `edgeToEdgeEnabled` dibuja bajo la barra de navegación de Android:
            // sin este inset los botones del sistema tapan el botón de finalizar.
            { paddingBottom: Math.max(insets.bottom, 12) + 14 },
            esLider ? styles.endBarDanger : styles.endBarGhost,
            pressed && styles.endBarPressed,
            accion && styles.endBarDisabled,
          ]}
          onPress={esLider ? confirmarFinalizar : confirmarSalir}
          disabled={accion}
        >
          <Text
            style={[styles.endBarText, esLider ? styles.endBarTextDanger : styles.endBarTextGhost]}
          >
            {accion ? 'Procesando...' : esLider ? 'Finalizar viaje' : 'Salir del viaje'}
          </Text>
        </Pressable>
      </View>

      <CategoriaParadaSheet
        visible={eligiendoCategoria}
        onSeleccionar={handleCategoriaElegida}
        onCancelar={() => setEligiendoCategoria(false)}
      />

      <CrearAlertaSheet
        visible={componiendoAlerta}
        enviando={alertaEnviando}
        onPublicar={handlePublicarAlerta}
        onCancelar={() => setComponiendoAlerta(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  endBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  endBarDanger: {
    backgroundColor: '#fff1f2',
    borderTopColor: '#fecaca',
  },
  endBarGhost: {
    backgroundColor: '#f9fafb',
    borderTopColor: '#e5e7eb',
  },
  endBarPressed: {
    opacity: 0.7,
  },
  endBarDisabled: {
    opacity: 0.45,
  },
  endBarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  endBarTextDanger: {
    color: '#dc2626',
  },
  endBarTextGhost: {
    color: '#6b7280',
  },
  bannerStack: {
    position: 'absolute',
    top: 128,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 30,
  },
  warnBanner: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
  },
  warnTxt: {
    color: '#92400e',
    fontSize: 13,
  },
  infoBanner: {
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 8,
  },
  infoTxt: {
    color: '#1e40af',
    fontSize: 12,
  },
})
