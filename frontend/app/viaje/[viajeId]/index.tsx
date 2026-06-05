import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Defs, Pattern, Path, Circle, Rect } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'

import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import { connectMeshSocket } from '@/lib/meshSocket'
import { iniciarTrackingViaje, solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import { 
  iniciarViajeEnBackend, 
  obtenerViaje, 
  listarParticipantesViaje,
  type ViajeDetalleApi, 
  type ViajeParticipanteApi 
} from '@/lib/viajesApi'
import { 
  TopBar, 
  Btn, 
  Badge, 
  Field, 
  Avatar, 
  ActivityTile, 
  useTheme 
} from '@/components/MeshUI'

function RouteMini({ theme }: { theme: any }) {
  return (
    <View style={{ position: 'relative', height: 120, backgroundColor: theme.mapBg, overflow: 'hidden' }}>
      <Svg width="100%" height="120" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <Pattern id="rmgrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <Path d="M26 0H0V26" fill="none" stroke={theme.mapGrid} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="120" fill="url(#rmgrid)" />
        {/* Route curve */}
        <Path 
          d="M30 90 C 90 85, 80 40, 150 45 S 250 75, 292 25" 
          fill="none" 
          stroke={theme.mapRoute} 
          strokeWidth={6} 
          strokeLinecap="round" 
        />
        <Path 
          d="M30 90 C 90 85, 80 40, 150 45 S 250 75, 292 25" 
          fill="none" 
          stroke={theme.accent} 
          strokeWidth={2.5} 
          strokeLinecap="round" 
          strokeDasharray="2 7" 
          opacity={0.95}
        />
        {/* Start dot */}
        <Circle cx="30" cy="90" r="5" fill={theme.textDim} />
        {/* Destination dot */}
        <Circle cx="292" cy="25" r="6" fill={theme.accent} />
        <Circle cx="292" cy="25" r="2" fill={theme.background} />
      </Svg>
    </View>
  )
}

export default function ViajeDetalleScreen() {
  const router = useRouter()
  const theme = useTheme()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userFromQuery = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || DEV_USER_ID
  }, [params.userId])

  const [userId, setUserId] = useState(userFromQuery)
  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [ubicacionBloqueada, setUbicacionBloqueada] = useState(false)

  const esLider = viaje != null && userId.trim() === viaje.creador_id

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
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    try {
      const v = await obtenerViaje(viajeId, userId.trim())
      setViaje(v)
      try {
        const parts = await listarParticipantesViaje(viajeId, userId.trim())
        setParticipantes(parts)
      } catch (e) {
        console.warn('No se pudieron cargar los participantes:', e)
      }
    } catch (e) {
      setViaje(null)
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cargar el viaje')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (userId.trim()) {
      void AsyncStorage.setItem('mesh:activeUserId', userId.trim())
    }
  }, [userId])

  const abrirAjustes = () => {
    void Linking.openSettings()
  }

  const confirmarIniciar = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Solo móvil', 'El tracking GPS está disponible en Android / iOS.')
      return
    }
    setModalPermisos(true)
  }

  const ejecutarIniciar = async () => {
    if (!viajeId || !userId.trim()) return
    setModalPermisos(false)
    setAccion(true)
    try {
      const perm = await solicitarPermisosUbicacion()
      setUbicacionBloqueada(!perm.foreground)

      await iniciarViajeEnBackend(viajeId, userId.trim())
      await cargar()

      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      if (perm.foreground) {
        await iniciarTrackingViaje(viajeId, userId.trim())
      }

      router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo iniciar')
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

      {loading ? (
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
                {viaje.es_grupal ? `Salida con ${viaje.creador.nombre}` : `Salida individual`}
              </Text>
            </View>

            {/* Schematic route preview */}
            <View style={[styles.cardRoute, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {viaje.ruta ? (
                <>
                  <RouteMini theme={theme} />
                  <View style={styles.routePoints}>
                    <View style={styles.routePointRow}>
                      <View style={[styles.routePointDot, { backgroundColor: theme.textDim }]} />
                      <Text style={[styles.routePointText, { color: theme.text }]} numberOfLines={1}>
                        Inicio
                      </Text>
                    </View>
                    <Feather name="arrow-right" size={14} color={theme.textMute} />
                    <View style={styles.routePointRow}>
                      <View style={[styles.routePointDot, { backgroundColor: theme.accent }]} />
                      <Text style={[styles.routePointText, { color: theme.text }]} numberOfLines={1}>
                        Destino
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

            {/* Developer Simulation Panel */}
            <View style={[styles.devCard, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
              <View style={styles.devHeader}>
                <Feather name="terminal" size={13} color={theme.textDim} style={{ marginRight: 6 }} />
                <Text style={[styles.devTitle, { color: theme.textDim }]}>Panel de Desarrollo</Text>
              </View>
              <Field
                label="Usuario simulado"
                value={userId}
                onChangeText={setUserId}
                placeholder="UUID"
                autoCapitalize="none"
                style={{ marginTop: 8 }}
              />
              <Text style={[styles.devHint, { color: theme.textMute }]}>
                Cambiar el ID simula la vista del viaje desde la perspectiva de otro usuario.
              </Text>
            </View>
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
                Esperando al líder del viaje...
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
              Para iniciar el viaje, Mesh necesita ubicación precisa y, en Android, permiso en segundo plano para el
              servicio en primer plano (notificación fija) y envíos cada 5 segundos.
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
  devCard: {
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 14,
    marginTop: 8,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  devHint: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
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
