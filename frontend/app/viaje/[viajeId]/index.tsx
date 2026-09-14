import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, 
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { meshAlert } from '@/lib/meshAlert';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'

import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { emitTripStartedWithRetry } from '@/lib/tripBroadcast'
import { detenerTrackingViaje, solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import {
  iniciarViajeEnBackend,
  finalizarViaje,
  salirViaje,
  eliminarViaje,
  obtenerViaje,
  obtenerRuta,
  actualizarFechaViaje,
  actualizarViaje,
  listarParticipantesViaje,
  type ParametrosViajeInput,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'
import {
  compartirRutaViaje,
  revocarCompartirRutaViaje,
} from '@/lib/rutasCompartidasApi'
import { MeshApiError } from '@/lib/apiClient'
import { waypointsFromRutaDetalle } from '@/lib/routePayload'
import { ajustarSiQuedoEnPasado, esFechaFutura } from '@/lib/fechaProgramada'
import { aCamposArg, ahoraEnCamposArg, desdeCamposArg, formatearEnArg } from '@/lib/tiempoArg'
import { RouteMapView } from '@/components/route-config/RouteMapView'
import { ClimaViajeCard } from '@/components/ClimaViajeCard'
import { ParametrosGrupoCard } from '@/components/ParametrosGrupoCard'
import {
  REGION_FALLBACK,
  waypointTieneCoords,
  type RouteWaypoint,
} from '@/components/route-config/routeTypes'
import {
  TopBar,
  Btn,
  Badge,
  Avatar,
  ActivityTile,
  useTheme,
} from '@/components/MeshUI'

type RutaMapa = {
  waypoints: RouteWaypoint[]
  routeLine: [number, number][]
}

/** Etiqueta del estado de un participante. 'salido' = abandonó el viaje en curso. */
function badgeParticipante(estado: ViajeParticipanteApi['estado']): {
  texto: string
  tone: 'good' | 'mute' | 'live'
} {
  switch (estado) {
    case 'confirmado':
      return { texto: 'Confirmó', tone: 'good' }
    case 'pendiente':
      return { texto: 'Pendiente', tone: 'mute' }
    case 'salido':
      return { texto: 'Salió', tone: 'mute' }
    case 'rechazado':
      return { texto: 'Rechazó', tone: 'live' }
  }
}

/** Mapa OSM real (solo lectura) con la ruta planificada del viaje. */
function RutaMapaPreview({ ruta }: { ruta: RutaMapa }) {
  const primero = ruta.waypoints.find(waypointTieneCoords)
  const initialRegion = primero
    ? {
        latitude: primero.lat,
        longitude: primero.lon,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    : REGION_FALLBACK

  const fitCoords =
    ruta.routeLine.length > 1
      ? ruta.routeLine.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      : null

  return (
    <View style={styles.mapBox}>
      <RouteMapView
        waypoints={ruta.waypoints}
        routeLineLatLng={ruta.routeLine.length > 1 ? ruta.routeLine : null}
        mapStyle="standard"
        initialRegion={initialRegion}
        cameraTarget={null}
        fitRouteCoords={fitCoords}
        mapPickMode={false}
      />
    </View>
  )
}

export default function ViajeDetalleScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { backendUserId, backendSyncing } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || backendUserId || DEV_USER_ID || ''
  }, [params.userId, backendUserId])

  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [rutaMapa, setRutaMapa] = useState<RutaMapa | null>(null)
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [ubicacionBloqueada, setUbicacionBloqueada] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date')
  const [fechaEdit, setFechaEdit] = useState<Date>(() => new Date())
  const [guardandoFecha, setGuardandoFecha] = useState(false)
  const [guardandoAlertaConfig, setGuardandoAlertaConfig] = useState(false)
  const [guardandoParametros, setGuardandoParametros] = useState(false)
  const [alertaConfigAbierta, setAlertaConfigAbierta] = useState(false)
  const [participantesAbierto, setParticipantesAbierto] = useState(false)

  const esLider = viaje != null && userId === viaje.creador_id
  const puedeCompartirRuta =
    !!rutaMapa &&
    (esLider || viaje?.mi_participacion?.estado === 'confirmado')
  const { syncKnownTripIds } = useTripRealtime()

  useEffect(() => {
    if (viajeId) syncKnownTripIds([viajeId])
  }, [viajeId, syncKnownTripIds])

  const origenNombre = useMemo(
    () => rutaMapa?.waypoints.find((w) => w.type === 'ORIGIN')?.name?.trim() || 'Inicio',
    [rutaMapa]
  )
  const destinoNombre = useMemo(
    () => rutaMapa?.waypoints.find((w) => w.type === 'DESTINATION')?.name?.trim() || 'Destino',
    [rutaMapa]
  )

  const formatFecha = (isoString: string) =>
    formatearEnArg(
      isoString,
      { weekday: 'short', day: 'numeric', month: 'short' },
      isoString
    )

  const formatHora = (isoString: string) =>
    formatearEnArg(isoString, { hour: '2-digit', minute: '2-digit' }, '')

  const cargar = useCallback(async () => {
    if (!viajeId || !userId) return
    setLoading(true)
    try {
      const v = await obtenerViaje(viajeId, userId)
      setViaje(v)

      try {
        const parts = await listarParticipantesViaje(viajeId, userId)
        setParticipantes(parts)
      } catch (e) {
        console.warn('No se pudieron cargar los participantes:', e)
      }

      try {
        const r = await obtenerRuta(viajeId, userId)
        if (r) {
          const h = waypointsFromRutaDetalle(r)
          const waypoints: RouteWaypoint[] = [
            { ...h.origen, id: 'origen' },
            ...h.paradas.map((p, i) => ({ ...p, id: `parada-${i}` })),
            { ...h.destino, id: 'destino' },
          ]
          setRutaMapa({ waypoints, routeLine: h.routeLineLatLng })
        } else {
          setRutaMapa(null)
        }
      } catch (e) {
        console.warn('No se pudo cargar la ruta del viaje:', e)
        setRutaMapa(null)
      }
    } catch (e) {
      setViaje(null)
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo cargar el viaje')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useFocusEffect(
    useCallback(() => {
      if (userId) void cargar()
    }, [cargar, userId])
  )

  useEffect(() => {
    if (userId) void AsyncStorage.setItem('mesh:activeUserId', userId)
  }, [userId])

  const abrirAjustes = () => {
    void Linking.openSettings()
  }

  const compartirRuta = useCallback(async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    try {
      const out = await compartirRutaViaje(viajeId, userId)
      await Share.share(
        Platform.OS === 'ios'
          ? { url: out.link, message: 'Te comparto una ruta de Mesh' }
          : { message: `Te comparto una ruta de Mesh: ${out.link}` }
      )
    } catch (e) {
      const msg =
        e instanceof MeshApiError && e.code === 'RUTA_INCOMPLETA'
          ? 'Configurá la ruta completa antes de compartirla.'
          : e instanceof Error
            ? e.message
            : 'No se pudo compartir la ruta'
      meshAlert('Error', msg)
    } finally {
      setAccion(false)
    }
  }, [viajeId, userId])

  const revocarLinkRuta = useCallback(() => {
    if (!viajeId || !userId) return
    meshAlert('Revocar link', '¿Quienes tengan el link ya no podrán ver ni importar esta ruta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setAccion(true)
            try {
              await revocarCompartirRutaViaje(viajeId, userId)
              meshAlert('Listo', 'El link de la ruta fue revocado.')
            } catch (e) {
              meshAlert('Error', e instanceof Error ? e.message : 'No se pudo revocar')
            } finally {
              setAccion(false)
            }
          })()
        },
      },
    ])
  }, [viajeId, userId])

  const puedeEditarPlan = viaje?.estado === 'planificado' && esLider
  const puedeConfigurarAlertas =
    esLider && viaje?.es_grupal === true && viaje.estado !== 'finalizado'

  const guardarConfigAlerta = useCallback(
    async (input: {
      alertaIncidenteHabilitada?: boolean
      alertaIncidenteMinutos?: number | null
      alertasSoloLider?: boolean
    }) => {
      if (!viajeId || !userId || !puedeConfigurarAlertas) return
      setGuardandoAlertaConfig(true)
      try {
        const actualizado = await actualizarViaje(viajeId, userId, input)
        setViaje((prev) =>
          prev
            ? {
                ...prev,
                alerta_incidente_habilitada: actualizado.alerta_incidente_habilitada,
                alerta_incidente_minutos: actualizado.alerta_incidente_minutos,
                alerta_incidente_minutos_efectivo: actualizado.alerta_incidente_minutos_efectivo,
                alertas_solo_lider: actualizado.alertas_solo_lider,
              }
            : prev
        )
      } catch (e) {
        meshAlert('Error', e instanceof Error ? e.message : 'No se pudo guardar la configuración')
      } finally {
        setGuardandoAlertaConfig(false)
      }
    },
    [viajeId, userId, puedeConfigurarAlertas]
  )

  // RN-025 / RN-030: el líder ajusta los parámetros mientras el viaje no esté finalizado.
  const puedeEditarParametros = esLider && viaje?.estado !== 'finalizado'

  const guardarParametros = useCallback(
    async (input: ParametrosViajeInput) => {
      if (!viajeId || !userId || !puedeEditarParametros) return
      setGuardandoParametros(true)
      try {
        const actualizado = await actualizarViaje(viajeId, userId, input)
        setViaje((prev) =>
          prev
            ? {
                ...prev,
                velocidad_esperada: actualizado.velocidad_esperada,
                distancia_max_separacion: actualizado.distancia_max_separacion,
                tolerancia_atraso_min: actualizado.tolerancia_atraso_min,
                tolerancia_atraso_min_efectivo: actualizado.tolerancia_atraso_min_efectivo,
              }
            : prev
        )
      } catch (e) {
        meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron guardar los parámetros')
      } finally {
        setGuardandoParametros(false)
      }
    },
    [viajeId, userId, puedeEditarParametros]
  )

  const abrirPicker = (mode: 'date' | 'time') => {
    if (!viaje || !puedeEditarPlan) return
    setFechaEdit(new Date(viaje.fecha_programada))
    setPickerMode(mode)
    setShowPicker(true)
  }

  const irConfigurarRecorrido = () => {
    if (!viajeId || !puedeEditarPlan) return
    router.push({ pathname: '/configurar-ruta/[viajeId]', params: { viajeId } })
  }

  const guardarFecha = useCallback(
    async (nueva: Date) => {
      if (!viajeId || !userId) return
      if (!esFechaFutura(nueva)) {
        meshAlert('Fecha inválida', 'La fecha y hora programadas deben ser futuras.')
        return
      }
      setGuardandoFecha(true)
      try {
        await actualizarFechaViaje(viajeId, userId, nueva)
        await cargar()
      } catch (e) {
        meshAlert('Error', e instanceof Error ? e.message : 'No se pudo actualizar la fecha')
      } finally {
        setGuardandoFecha(false)
      }
    },
    [viajeId, userId, cargar]
  )

  const onChangeFecha = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) {
      setShowPicker(false)
      return
    }

    // El picker nativo lee y escribe en la zona del dispositivo, así que lo que
    // devuelve se interpreta como campos de hora argentina (RN-105).
    const campos = aCamposArg(fechaEdit)
    if (pickerMode === 'date') {
      campos.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
    } else {
      campos.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
    }
    const instante = ajustarSiQuedoEnPasado(desdeCamposArg(campos))

    if (Platform.OS !== 'ios') {
      setShowPicker(false)
      if (!esFechaFutura(instante)) {
        meshAlert('Fecha inválida', 'La fecha y hora programadas deben ser futuras.')
        return
      }
      setFechaEdit(instante)
      void guardarFecha(instante)
      return
    }

    if (!esFechaFutura(instante)) {
      meshAlert('Fecha inválida', 'La fecha y hora programadas deben ser futuras.')
      return
    }
    setFechaEdit(instante)
  }

  const confirmarIniciar = () => {
    if (Platform.OS === 'web') {
      meshAlert('Solo móvil', 'El tracking GPS está disponible en Android / iOS.')
      return
    }
    setModalPermisos(true)
  }

  const ejecutarIniciar = async () => {
    if (!viajeId || !userId) return
    setModalPermisos(false)
    setAccion(true)
    try {
      const perm = await solicitarPermisosUbicacion()
      setUbicacionBloqueada(!perm.foreground)

      const actualizado = await iniciarViajeEnBackend(viajeId, userId)

      // Navegar a live inmediatamente para que el usuario no vea el botón
      // "Finalizar viaje" en loading state mientras se hace el setup posterior.
      router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })

      // Supabase broadcast en background; socket y tracking los maneja live.tsx.
      if (isSupabaseConfigured()) {
        void emitTripStartedWithRetry(viajeId, {
          viajeId,
          nombre: actualizado.nombre ?? viaje?.nombre ?? null,
          estado: 'en_curso',
          fechaInicioReal: actualizado.fecha_inicio_real ?? new Date().toISOString(),
          iniciadoPor: userId,
        }).catch((e) => console.warn('Broadcast TRIP_STARTED falló:', e))
      }
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo iniciar')
    } finally {
      setAccion(false)
    }
  }

  const confirmarEliminar = () => {
    meshAlert(
      'Cancelar viaje',
      '¿Estás seguro? Esto eliminará el viaje para todos los participantes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void ejecutarEliminar() },
      ]
    )
  }

  const ejecutarEliminar = async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    try {
      await eliminarViaje(viajeId, userId)
      router.replace('/(tabs)')
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el viaje')
      setAccion(false)
    }
  }

  const confirmarFinalizar = () => {
    meshAlert(
      'Finalizar viaje',
      '¿Estás seguro? Esto detendrá el tracking de todos los participantes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: () => void ejecutarFinalizar(),
        },
      ]
    )
  }

  const ejecutarFinalizar = async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    try {
      await finalizarViaje(viajeId, userId)
      await detenerTrackingViaje()
      await cargar()
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo finalizar el viaje')
    } finally {
      setAccion(false)
    }
  }

  const confirmarSalir = () => {
    meshAlert(
      'Salir del viaje',
      '¿Estás seguro? Dejarás de compartir tu ubicación con el grupo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => void ejecutarSalir(),
        },
      ]
    )
  }

  const ejecutarSalir = async () => {
    if (!viajeId || !userId) return
    setAccion(true)
    try {
      await salirViaje(viajeId, userId)
      await detenerTrackingViaje()
      router.replace('/(tabs)')
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo salir del viaje')
      setAccion(false)
    }
  }

  const irLive = () => {
    if (!viajeId) return
    router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
  }

  if (!viajeId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textDim }}>Falta el identificador del viaje.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title={viaje?.estado === 'planificado' ? 'Configurando viaje' : 'Viaje'}
        sub={!viaje ? 'Cargando...' : undefined}
        onBack={() => router.back()}
        bordered={false}
        right={
          viaje ? (
            <View style={styles.topBarActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/viaje/[viajeId]/qr', params: { viajeId } })}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border }
                ]}
              >
                <Feather name="share-2" size={18} color={theme.text} />
              </Pressable>
              {esLider && viaje.estado === 'planificado' ? (
                <Pressable
                  onPress={confirmarEliminar}
                  disabled={accion}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    {
                      backgroundColor: pressed ? theme.dangerWeak : theme.surface,
                      borderColor: theme.danger,
                      opacity: accion ? 0.6 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar viaje"
                >
                  <Feather name="trash-2" size={18} color={theme.danger} />
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
      />

      {loading || backendSyncing || !userId ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : viaje ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerInfo}>
              <View style={styles.badgeRow}>
                <Badge tone={viaje.estado === 'en_curso' ? 'live' : viaje.estado === 'planificado' ? 'accent' : 'mute'} pulse={viaje.estado === 'en_curso'}>
                  {viaje.estado === 'en_curso' ? 'En vivo' : viaje.estado === 'planificado' ? 'Planificado' : 'Finalizado'}
                </Badge>
                <ActivityTile activity={viaje.tipo_actividad} size={28} />
              </View>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {viaje.nombre?.trim() || (viaje.es_grupal ? 'Salida grupal' : 'Salida individual')}
                </Text>
                {viaje.nombre?.trim() ? (
                  <Text style={[styles.titleAside, { color: theme.textDim }]}>
                    {viaje.es_grupal ? 'Salida grupal' : 'Salida individual'}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Mapa real de la ruta planificada */}
            <Pressable
              onPress={irConfigurarRecorrido}
              disabled={!puedeEditarPlan}
              style={({ pressed }) => [
                styles.cardRoute,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed && puedeEditarPlan ? 0.92 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Configurar recorrido"
            >
              {rutaMapa ? (
                <>
                  <View>
                    <RutaMapaPreview ruta={rutaMapa} />
                    {puedeEditarPlan ? <View style={StyleSheet.absoluteFill} /> : null}
                  </View>
                  <View style={styles.routePoints}>
                    <View style={styles.routePointRow}>
                      <View style={[styles.routePointDot, { backgroundColor: theme.textDim }]} />
                      <Text style={[styles.routePointText, { color: theme.text }]} numberOfLines={1}>
                        {origenNombre}
                      </Text>
                    </View>
                    <Feather name="arrow-right" size={14} color={theme.textMute} />
                    <View style={styles.routePointRow}>
                      <View style={[styles.routePointDot, { backgroundColor: theme.accent }]} />
                      <Text style={[styles.routePointText, { color: theme.text }]} numberOfLines={1}>
                        {destinoNombre}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.mapBox}>
                  <RouteMapView
                    waypoints={[]}
                    routeLineLatLng={null}
                    mapStyle="standard"
                    initialRegion={REGION_FALLBACK}
                    cameraTarget={null}
                    fitRouteCoords={null}
                    mapPickMode={false}
                  />
                  <View style={styles.noRouteOverlay} pointerEvents="none">
                    <View style={[styles.noRoutePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Feather name="map" size={24} color={theme.textMute} style={{ marginBottom: 6 }} />
                      <Text style={[styles.noRouteTitle, { color: theme.text }]}>Recorrido sin configurar</Text>
                      <Text style={[styles.noRouteBody, { color: theme.textDim }]}>
                        {puedeEditarPlan
                          ? 'Tocá acá para definir el trayecto y habilitar la guía GPS en vivo.'
                          : 'Definí el trayecto para habilitar la guía GPS en vivo.'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Pressable>

            {/* SCRUM-27: pronóstico sobre la ruta antes de salir (y durante). */}
            <ClimaViajeCard
              viajeId={viajeId}
              habilitado={viaje.estado !== 'finalizado'}
              claveRefresco={`${viaje.fecha_programada}:${viaje.ruta?.id ?? ''}:${rutaMapa?.waypoints.length ?? 0}`}
            />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="activity" size={16} color={theme.accent} style={{ marginBottom: 3 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {viaje.ruta?.distancia_planeada_m
                    ? `${(viaje.ruta.distancia_planeada_m / 1000).toFixed(1)} km`
                    : '--'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Distancia</Text>
              </View>

              <Pressable
                onPress={() => abrirPicker('time')}
                disabled={!puedeEditarPlan || guardandoFecha}
                style={({ pressed }) => [
                  styles.statCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed && puedeEditarPlan ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Editar hora"
              >
                <Feather name="clock" size={16} color={theme.accent} style={{ marginBottom: 3 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {formatHora(viaje.fecha_programada)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Hora</Text>
              </Pressable>

              <Pressable
                onPress={() => abrirPicker('date')}
                disabled={!puedeEditarPlan || guardandoFecha}
                style={({ pressed }) => [
                  styles.statCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed && puedeEditarPlan ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Editar fecha"
              >
                <Feather name="calendar" size={16} color={theme.accent} style={{ marginBottom: 3 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {formatFecha(viaje.fecha_programada)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Fecha</Text>
              </Pressable>
            </View>

            {(puedeConfigurarAlertas || viaje.es_grupal) && (
            <View style={styles.collapsibleGroup}>
            {/* SCRUM-26: parámetros del grupo (RN-025). */}
            <ParametrosGrupoCard
              viaje={viaje}
              editable={puedeEditarParametros}
              guardando={guardandoParametros}
              onGuardar={(input) => void guardarParametros(input)}
            />
            {puedeConfigurarAlertas && viaje ? (
              <View style={[styles.alertConfigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  onPress={() => setAlertaConfigAbierta((v) => !v)}
                  style={({ pressed }) => [styles.alertConfigHeader, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Configurar alertas"
                  accessibilityState={{ expanded: alertaConfigAbierta }}
                >
                  <Feather name="alert-triangle" size={16} color={theme.accent} />
                  <Text style={[styles.alertConfigTitle, { color: theme.text }]}>
                    Configurar alertas
                  </Text>
                  <Feather
                    name={alertaConfigAbierta ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textDim}
                  />
                </Pressable>

                {alertaConfigAbierta ? (
                  <>
                <Text style={[styles.alertConfigHint, { color: theme.textDim }]}>
                  Si alguien queda detenido sin registrar parada, el líder recibe una alerta automática.
                </Text>

                <Pressable
                  onPress={() =>
                    void guardarConfigAlerta({
                      alertaIncidenteHabilitada: !viaje.alerta_incidente_habilitada,
                    })
                  }
                  disabled={guardandoAlertaConfig}
                  style={({ pressed }) => [
                    styles.alertToggleRow,
                    { borderColor: theme.border, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Text style={[styles.alertToggleLabel, { color: theme.text }]}>Detección automática</Text>
                  <View
                    style={[
                      styles.alertTogglePill,
                      {
                        backgroundColor: viaje.alerta_incidente_habilitada ? theme.good : theme.surface2,
                        borderColor: viaje.alerta_incidente_habilitada ? theme.good : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.alertTogglePillTxt,
                        { color: viaje.alerta_incidente_habilitada ? '#fff' : theme.textDim },
                      ]}
                    >
                      {viaje.alerta_incidente_habilitada ? 'Activa' : 'Off'}
                    </Text>
                  </View>
                </Pressable>

                {viaje.alerta_incidente_habilitada ? (
                  <View style={styles.alertMinutosRow}>
                    <Text style={[styles.alertMinutosLabel, { color: theme.textDim }]}>
                      Minutos quieto sin parada
                    </Text>
                    <View style={styles.alertMinutosControls}>
                      <Pressable
                        onPress={() => {
                          const base =
                            viaje.alerta_incidente_minutos ?? viaje.alerta_incidente_minutos_efectivo
                          if (base <= 2) return
                          void guardarConfigAlerta({ alertaIncidenteMinutos: base - 1 })
                        }}
                        disabled={guardandoAlertaConfig}
                        style={[styles.alertStepBtn, { borderColor: theme.border }]}
                      >
                        <Feather name="minus" size={16} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.alertMinutosValue, { color: theme.text }]}>
                        {viaje.alerta_incidente_minutos_efectivo} min
                      </Text>
                      <Pressable
                        onPress={() => {
                          const base =
                            viaje.alerta_incidente_minutos ?? viaje.alerta_incidente_minutos_efectivo
                          if (base >= 30) return
                          void guardarConfigAlerta({ alertaIncidenteMinutos: base + 1 })
                        }}
                        disabled={guardandoAlertaConfig}
                        style={[styles.alertStepBtn, { borderColor: theme.border }]}
                      >
                        <Feather name="plus" size={16} color={theme.text} />
                      </Pressable>
                      {viaje.alerta_incidente_minutos != null ? (
                        <Pressable
                          onPress={() => void guardarConfigAlerta({ alertaIncidenteMinutos: null })}
                          disabled={guardandoAlertaConfig}
                          hitSlop={6}
                        >
                          <Text style={[styles.alertResetTxt, { color: theme.accent }]}>Por actividad</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={() =>
                    void guardarConfigAlerta({
                      alertasSoloLider: !(viaje.alertas_solo_lider ?? true),
                    })
                  }
                  disabled={guardandoAlertaConfig}
                  style={({ pressed }) => [
                    styles.alertToggleRow,
                    { borderColor: theme.border, opacity: pressed ? 0.88 : 1, marginTop: 10 },
                  ]}
                >
                  <Text style={[styles.alertToggleLabel, { color: theme.text }]}>
                    Solo el líder crea alertas
                  </Text>
                  <View
                    style={[
                      styles.alertTogglePill,
                      {
                        backgroundColor: (viaje.alertas_solo_lider ?? true) ? theme.good : theme.surface2,
                        borderColor: (viaje.alertas_solo_lider ?? true) ? theme.good : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.alertTogglePillTxt,
                        { color: (viaje.alertas_solo_lider ?? true) ? '#fff' : theme.textDim },
                      ]}
                    >
                      {(viaje.alertas_solo_lider ?? true) ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </Pressable>
                <Text style={[styles.alertConfigHint, { color: theme.textDim, marginTop: 6 }]}>
                  Si está desactivado, cualquier integrante puede enviar alertas manuales durante el viaje.
                </Text>
                  </>
                ) : null}
              </View>
            ) : null}

            {viaje.es_grupal && (
              <View style={[styles.alertConfigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  onPress={() => setParticipantesAbierto((v) => !v)}
                  style={({ pressed }) => [styles.alertConfigHeader, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Participantes"
                  accessibilityState={{ expanded: participantesAbierto }}
                >
                  <Feather name="users" size={16} color={theme.accent} />
                  <Text style={[styles.alertConfigTitle, { color: theme.text }]}>
                    Participantes · {participantes.length}
                  </Text>
                  <Feather
                    name={participantesAbierto ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textDim}
                  />
                </Pressable>

                {participantesAbierto ? (
                  <>
                    {participantes.slice(0, 4).map((part) => {
                      const dummyPerson = {
                        nombre: part.usuario.nombre,
                        apellido: '',
                      }
                      return (
                        <View key={part.usuario.id} style={[styles.participantRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                          <Avatar person={dummyPerson} size="sm" />
                          <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
                            {part.usuario.nombre}
                            {part.usuario.id === userId ? ' (vos)' : ''}
                          </Text>
                          <Badge tone={badgeParticipante(part.estado).tone}>
                            {badgeParticipante(part.estado).texto}
                          </Badge>
                        </View>
                      )
                    })}
                    <Btn
                      variant="secondary"
                      block
                      icon="users"
                      onPress={() => router.push({ pathname: '/viaje/[viajeId]/miembros', params: { viajeId } })}
                    >
                      {participantes.length > 4 ? 'Ver todos los miembros' : 'Ver miembros'}
                    </Btn>
                  </>
                ) : null}
              </View>
            )}
            </View>
            )}

            {puedeEditarPlan && showPicker && (
              <View>
                <DateTimePicker
                  key={pickerMode}
                  value={aCamposArg(
                    esFechaFutura(fechaEdit) ? fechaEdit : ajustarSiQuedoEnPasado(fechaEdit)
                  )}
                  mode={pickerMode}
                  display={Platform.OS === 'ios' ? (pickerMode === 'date' ? 'inline' : 'spinner') : 'default'}
                  minimumDate={pickerMode === 'date' ? ahoraEnCamposArg() : undefined}
                  onChange={onChangeFecha}
                />
                {Platform.OS === 'ios' ? (
                  <Btn
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setShowPicker(false)
                      void guardarFecha(fechaEdit)
                    }}
                    loading={guardandoFecha}
                    disabled={guardandoFecha}
                  >
                    Guardar {pickerMode === 'date' ? 'fecha' : 'hora'}
                  </Btn>
                ) : null}
              </View>
            )}

            {ubicacionBloqueada && (
              <View style={[styles.warnCard, { backgroundColor: theme.dangerWeak, borderColor: theme.danger }]}>
                <Feather name="alert-triangle" size={16} color={theme.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.warnText, { color: theme.text }]}>
                  Ubicación desconocida: no se compartirá tu posición hasta otorgar permisos.
                </Text>
              </View>
            )}

            {(() => {
              const puedeInvitar = viaje.estado === 'planificado' && esLider
              const puedeChecklist =
                viaje.estado !== 'finalizado' &&
                (esLider || viaje.mi_participacion?.estado === 'confirmado')
              const puedeGastos =
                viaje.es_grupal &&
                viaje.estado !== 'finalizado' &&
                (esLider || viaje.mi_participacion?.estado === 'confirmado')
              if (!puedeInvitar && !puedeChecklist && !puedeGastos) return null
              return (
                <View style={styles.preTripActions}>
                  {puedeInvitar && (
                    <Btn
                      variant="secondary"
                      block
                      size="sm"
                      icon="share-2"
                      onPress={() =>
                        router.push({ pathname: '/viaje/[viajeId]/qr', params: { viajeId } })
                      }
                    >
                      Invitar / Compartir QR
                    </Btn>
                  )}
                  {puedeChecklist && (
                    <Btn
                      variant="secondary"
                      block
                      size="sm"
                      icon="check-square"
                      onPress={() =>
                        router.push({ pathname: '/viaje/[viajeId]/checklist', params: { viajeId } })
                      }
                    >
                      Checklist de preparativos
                    </Btn>
                  )}
                  {puedeGastos && (
                    <Btn
                      variant="secondary"
                      block
                      size="sm"
                      icon="dollar-sign"
                      onPress={() =>
                        router.push({ pathname: '/viaje/[viajeId]/gastos', params: { viajeId } })
                      }
                    >
                      Gastos compartidos
                    </Btn>
                  )}
                </View>
              )
            })()}

            {puedeCompartirRuta && (
              <View style={styles.optionsBlock}>
                <Btn
                  variant="secondary"
                  block
                  size="sm"
                  icon="map"
                  onPress={() => void compartirRuta()}
                  disabled={accion}
                  loading={accion}
                  style={{ marginBottom: esLider ? 8 : 0 }}
                >
                  Compartir ruta
                </Btn>
                {esLider ? (
                  <Btn
                    variant="ghost"
                    block
                    size="sm"
                  icon="x-circle"
                  onPress={revocarLinkRuta}
                    disabled={accion}
                  >
                    Revocar link de ruta
                  </Btn>
                ) : null}
              </View>
            )}

          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={[styles.bottomPad, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            {viaje.estado === 'planificado' && esLider && (
              <Btn variant="primary" block icon="play" onPress={confirmarIniciar} disabled={accion} loading={accion}>
                Iniciar viaje en vivo
              </Btn>
            )}

            {viaje.estado === 'planificado' && !esLider && (
              <Btn variant="ghost" block icon="log-out" onPress={confirmarSalir} disabled={accion} loading={accion}>
                Salir del viaje
              </Btn>
            )}

            {viaje.estado === 'en_curso' && (
              <View style={{ gap: 10 }}>
                <Btn variant="primary" block icon="navigation" onPress={irLive}>
                  Ver mapa en vivo
                </Btn>
                {esLider ? (
                  <Btn variant="danger" block icon="stop-circle" onPress={confirmarFinalizar} disabled={accion} loading={accion}>
                    Finalizar viaje
                  </Btn>
                ) : (
                  <Btn variant="ghost" block icon="log-out" onPress={confirmarSalir} disabled={accion} loading={accion}>
                    Salir del viaje
                  </Btn>
                )}
              </View>
            )}

            {viaje.estado === 'finalizado' && (
              <View style={{ gap: 10 }}>
                <Btn
                  variant="secondary"
                  block
                  icon="bar-chart-2"
                  onPress={() =>
                    router.push({ pathname: '/viaje/[viajeId]/resumen', params: { viajeId } })
                  }
                >
                  Ver resumen del recorrido
                </Btn>
                {viaje.es_grupal && (
                  <Btn
                    variant="ghost"
                    block
                    icon="dollar-sign"
                    onPress={() =>
                      router.push({ pathname: '/viaje/[viajeId]/gastos', params: { viajeId } })
                    }
                  >
                    Ver balance de gastos
                  </Btn>
                )}
                <Btn
                  variant="ghost"
                  block
                  icon="trending-up"
                  onPress={() =>
                    router.push({ pathname: '/viaje/[viajeId]/metricas', params: { viajeId } })
                  }
                >
                  Mis métricas detalladas
                </Btn>
              </View>
            )}
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: theme.textDim }}>No se pudo encontrar el viaje especificado.</Text>
        </View>
      )}

      {/* GPS Permissions Modal */}
      <Modal visible={modalPermisos} transparent animationType="fade">
        <View style={[styles.modalBg, { backgroundColor: theme.scrim }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Ubicación necesaria</Text>
            <Text style={[styles.modalBody, { color: theme.textDim }]}>
              {Platform.OS === 'ios'
                ? 'Mesh necesita tu ubicación para compartirla con el grupo cada 5 segundos. Para seguir transmitiendo con la pantalla apagada, elegí "Siempre" cuando iOS lo pregunte (o en Ajustes → Mesh → Ubicación).'
                : 'Para iniciar el viaje, Mesh necesita ubicación precisa y permiso en segundo plano para la notificación fija y envíos cada 5 segundos.'}
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              <Btn variant="primary" block onPress={() => void ejecutarIniciar()} disabled={accion} loading={accion}>
                Permitir e Iniciar
              </Btn>
              <Btn variant="secondary" block onPress={abrirAjustes}>
                Abrir ajustes de Android/iOS
              </Btn>
              <Btn variant="ghost" block onPress={() => setModalPermisos(false)}>
                Cancelar
              </Btn>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  titleAside: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardRoute: {
    borderRadius: 14,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  mapBox: {
    height: 148,
    width: '100%',
  },
  routePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  routePointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routePointText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  noRouteOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  noRoutePanel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 300,
  },
  noRouteTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginTop: 6,
  },
  noRouteBody: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'flex-start',
  },
  statNum: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  alertConfigCard: {
    borderWidth: 1.2,
    borderRadius: 14,
    padding: 11,
    gap: 8,
  },
  alertConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertConfigTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
  },
  alertConfigHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertToggleLabel: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  alertTogglePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alertTogglePillTxt: {
    fontSize: 12,
    fontWeight: '800',
  },
  alertMinutosRow: {
    gap: 8,
  },
  alertMinutosLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  alertMinutosControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertStepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertMinutosValue: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'center',
  },
  alertResetTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
  },
  warnText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  optionsBlock: {
    marginTop: 4,
  },
  preTripActions: {
    marginTop: 6,
    gap: 6,
  },
  collapsibleGroup: {
    gap: 6,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 11,
    gap: 12,
  },
  participantName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
  },
  bottomPad: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1.2,
  },
  modalBg: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    fontSize: 14.5,
    lineHeight: 21,
  },
})
