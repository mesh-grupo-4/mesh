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
import { connectMeshSocket } from '@/lib/meshSocket'
import { isSupabaseConfigured } from '@/lib/supabase'
import { emitTripStartedWithRetry } from '@/lib/tripBroadcast'
import { iniciarTrackingViaje, solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import {
  iniciarViajeEnBackend,
  obtenerViaje,
  obtenerRuta,
  actualizarFechaViaje,
  listarParticipantesViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'
import { waypointsFromRutaDetalle } from '@/lib/routePayload'
import { RouteMapView } from '@/components/route-config/RouteMapView'
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
        calculando={false}
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

  const esLider = viaje != null && userId === viaje.creador_id
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

  const formatFecha = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    } catch {
      return isoString
    }
  }

  const formatHora = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

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

  const abrirPickerFecha = () => {
    if (!viaje) return
    setFechaEdit(new Date(viaje.fecha_programada))
    setPickerMode('date')
    setShowPicker(true)
  }

  const guardarFecha = useCallback(
    async (nueva: Date) => {
      if (!viajeId || !userId) return
      if (nueva.getTime() <= Date.now()) {
        meshAlert('Fecha inválida', 'La fecha programada debe ser futura.')
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

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        const merged = new Date(fechaEdit)
        merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
        setFechaEdit(merged)
        setPickerMode('time')
        // el picker sigue abierto para elegir la hora
      } else {
        const merged = new Date(fechaEdit)
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
        setFechaEdit(merged)
        setShowPicker(false)
        void guardarFecha(merged)
      }
    } else {
      // iOS: modo datetime en una sola pasada
      setFechaEdit(selected)
    }
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
      await cargar()

      if (isSupabaseConfigured()) {
        try {
          await emitTripStartedWithRetry(viajeId, {
            viajeId,
            nombre: actualizado.nombre ?? viaje?.nombre ?? null,
            estado: 'en_curso',
            fechaInicioReal: actualizado.fecha_inicio_real ?? new Date().toISOString(),
            iniciadoPor: userId,
          })
        } catch (e) {
          console.warn('Broadcast TRIP_STARTED falló:', e)
          meshAlert(
            'Aviso',
            'El viaje inició correctamente, pero no se pudo notificar al grupo en tiempo real.'
          )
        }
      }

      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      if (perm.foreground) {
        try {
          await iniciarTrackingViaje(viajeId, userId)
        } catch (e) {
          console.warn('No se pudo iniciar tracking GPS:', e)
          meshAlert(
            'Viaje iniciado',
            perm.background
              ? 'El viaje comenzó, pero no pudimos activar el GPS. Revisá permisos de ubicación en Ajustes.'
              : 'El viaje comenzó. En iOS, para GPS con la pantalla bloqueada elegí "Siempre" en Ajustes → Mesh → Ubicación.'
          )
        }
      }

      router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo iniciar')
    } finally {
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
        title="Viaje"
        sub={viaje ? (viaje.es_grupal ? 'Salida Grupal' : 'Salida Individual') : 'Cargando...'}
        onBack={() => router.back()}
        bordered={false}
        right={
          viaje ? (
            <Pressable
              onPress={() => router.push({ pathname: '/viaje/[viajeId]/qr', params: { viajeId } })}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border }
              ]}
            >
              <Feather name="share-2" size={18} color={theme.text} />
            </Pressable>
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
              <Text style={[styles.title, { color: theme.text }]}>
                {viaje.nombre?.trim() || (viaje.es_grupal ? 'Salida grupal' : 'Salida individual')}
              </Text>
            </View>

            {/* Mapa real de la ruta planificada */}
            <View style={[styles.cardRoute, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {rutaMapa ? (
                <>
                  <RutaMapaPreview ruta={rutaMapa} />
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
                <View style={styles.noRouteCard}>
                  <Feather name="map" size={28} color={theme.textMute} style={{ marginBottom: 6 }} />
                  <Text style={[styles.noRouteTitle, { color: theme.text }]}>Recorrido sin configurar</Text>
                  <Text style={[styles.noRouteBody, { color: theme.textDim }]}>
                    Definí el trayecto para habilitar la guía GPS en vivo.
                  </Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="activity" size={18} color={theme.accent} style={{ marginBottom: 6 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {viaje.ruta?.distancia_planeada_m
                    ? `${(viaje.ruta.distancia_planeada_m / 1000).toFixed(1)} km`
                    : '--'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Distancia</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="clock" size={18} color={theme.accent} style={{ marginBottom: 6 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {formatHora(viaje.fecha_programada)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Hora</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="calendar" size={18} color={theme.accent} style={{ marginBottom: 6 }} />
                <Text style={[styles.statNum, { color: theme.text }]} numberOfLines={1}>
                  {formatFecha(viaje.fecha_programada)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textDim }]}>Fecha</Text>
              </View>
            </View>

            {ubicacionBloqueada && (
              <View style={[styles.warnCard, { backgroundColor: theme.dangerWeak, borderColor: theme.danger }]}>
                <Feather name="alert-triangle" size={16} color={theme.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.warnText, { color: theme.text }]}>
                  Ubicación desconocida: no se compartirá tu posición hasta otorgar permisos.
                </Text>
              </View>
            )}

            {/* Secondary operations inside ScrollView */}
            {viaje.estado === 'planificado' && esLider && (
              <View style={styles.optionsBlock}>
                <Btn
                  variant="secondary"
                  block
                  icon="clock"
                  onPress={abrirPickerFecha}
                  loading={guardandoFecha}
                  disabled={guardandoFecha}
                  style={{ marginBottom: 10 }}
                >
                  Editar fecha y hora
                </Btn>
                {showPicker && (
                  <DateTimePicker
                    value={fechaEdit}
                    mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={onChangeFecha}
                  />
                )}
                {Platform.OS === 'ios' && showPicker && (
                  <Btn
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setShowPicker(false)
                      void guardarFecha(fechaEdit)
                    }}
                    style={{ marginBottom: 10 }}
                  >
                    Guardar fecha
                  </Btn>
                )}
                <Btn
                  variant="secondary"
                  block
                  icon="map"
                  onPress={() => router.push({ pathname: '/configurar-ruta/[viajeId]', params: { viajeId } })}
                  style={{ marginBottom: 10 }}
                >
                  Configurar recorrido
                </Btn>
                <Btn
                  variant="secondary"
                  block
                  icon="share-2"
                  onPress={() => router.push({ pathname: '/viaje/[viajeId]/qr', params: { viajeId } })}
                >
                  Invitar / Compartir QR
                </Btn>
              </View>
            )}

            {/* Participants list */}
            {viaje.es_grupal && (
              <View style={styles.participantsSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Participantes · {participantes.length}
                </Text>
                {participantes.map((part) => {
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
                      <Badge tone={part.estado === 'confirmado' ? 'good' : part.estado === 'pendiente' ? 'mute' : 'live'}>
                        {part.estado === 'confirmado' ? 'Confirmó' : part.estado === 'pendiente' ? 'Pendiente' : 'Rechazó'}
                      </Badge>
                    </View>
                  )
                })}
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
              <Btn variant="secondary" block disabled>
                Esperando que el líder inicie el viaje
              </Btn>
            )}

            {viaje.estado === 'en_curso' && (
              <Btn variant="primary" block icon="navigation" onPress={irLive}>
                Ver mapa en vivo
              </Btn>
            )}

            {viaje.estado === 'finalizado' && (
              <Btn variant="secondary" block disabled icon="check">
                Viaje finalizado
              </Btn>
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
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18,
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
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardRoute: {
    borderRadius: 14,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  mapBox: {
    height: 220,
    width: '100%',
  },
  routePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
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
  noRouteCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'flex-start',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.2,
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
  participantsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
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
    padding: 20,
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
