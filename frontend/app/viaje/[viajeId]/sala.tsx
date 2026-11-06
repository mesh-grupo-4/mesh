import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvisoUbicacion, textoPermisoSistema } from '@/components/AvisoUbicacion'
import { Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { DestinoPicker } from '@/components/viaje-rapido/DestinoPicker'
import { InvitarGruposAmigosModal } from '@/components/viaje-rapido/InvitarGruposAmigosModal'
import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { useUbicacionActual } from '@/hooks/useUbicacionActual'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { arrancarViaje } from '@/lib/arrancarViaje'
import { buildInviteUrl } from '@/lib/inviteLinks'
import { meshAlert, meshSuccess, meshWarning } from '@/lib/meshAlert'
import { nombreCompleto } from '@/lib/nombres'
import { paramTexto } from '@/lib/nuevoViaje'
import { waypointsFromRutaDetalle } from '@/lib/routePayload'
import { guardarRutaRapida, type PuntoDestino } from '@/lib/rutaRapida'
import {
  listarParticipantesViaje,
  obtenerRuta,
  obtenerViaje,
  type TipoActividadApi,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

/** Cada cuánto se refresca quién se sumó mientras la sala está abierta. */
const MS_REFRESCO_PARTICIPANTES = 5000

/**
 * Sala de espera del "Viaje YA". El viaje ya existe en estado `planificado`
 * (así el QR sigue vigente, RN-015): el líder invita, opcionalmente agrega
 * destino y lo arranca cuando están todos. Solo la ve el líder (RN-030).
 */
export default function SalaEsperaScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const raw = useLocalSearchParams<{ viajeId: string; rutaFallo?: string | string[] }>()
  const viajeId = paramTexto(raw.viajeId) ?? ''
  const rutaFallo = paramTexto(raw.rutaFallo) === '1'
  const { backendUserId } = useAuth()
  const userId = useMemo(() => {
    try {
      return resolveBackendUserId(backendUserId)
    } catch {
      return null
    }
  }, [backendUserId])

  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [destino, setDestino] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [invitarAbierto, setInvitarAbierto] = useState(false)
  const [eligiendoDestino, setEligiendoDestino] = useState(false)
  const [guardandoDestino, setGuardandoDestino] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [arrancando, setArrancando] = useState(false)
  const { ubicacion } = useUbicacionActual({ activo: eligiendoDestino })

  const { syncKnownTripIds } = useTripRealtime()
  useEffect(() => {
    if (viajeId) syncKnownTripIds([viajeId])
  }, [viajeId, syncKnownTripIds])

  useEffect(() => {
    if (rutaFallo) {
      meshWarning(
        'Sin ruta',
        'El viaje se creó pero no pudimos calcular la ruta al destino. Podés probar de nuevo desde "Destino".'
      )
    }
  }, [rutaFallo])

  const cargarParticipantes = useCallback(async () => {
    if (!viajeId || !userId) return
    try {
      setParticipantes(await listarParticipantesViaje(viajeId, userId))
    } catch (e) {
      console.warn('No se pudieron cargar los participantes:', e)
    }
  }, [viajeId, userId])

  const cargarDestino = useCallback(async () => {
    if (!viajeId || !userId) return
    try {
      const r = await obtenerRuta(viajeId, userId)
      setDestino(r ? waypointsFromRutaDetalle(r).destino.name?.trim() || 'Destino' : null)
    } catch (e) {
      console.warn('No se pudo cargar la ruta:', e)
    }
  }, [viajeId, userId])

  const cargar = useCallback(async () => {
    if (!viajeId || !userId) return
    try {
      const v = await obtenerViaje(viajeId, userId)
      // La sala es solo para el líder y solo antes de arrancar.
      if (v.estado === 'en_curso') {
        router.replace({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
        return
      }
      if (v.estado !== 'planificado' || v.creador_id !== userId) {
        router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId } })
        return
      }
      setViaje(v)
      await Promise.all([cargarParticipantes(), cargarDestino()])
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo cargar el viaje.')
    } finally {
      setCargando(false)
    }
  }, [viajeId, userId, cargarParticipantes, cargarDestino])

  useFocusEffect(
    useCallback(() => {
      void cargar()
      const t = setInterval(() => void cargarParticipantes(), MS_REFRESCO_PARTICIPANTES)
      return () => clearInterval(t)
    }, [cargar, cargarParticipantes])
  )

  const inviteUrl = buildInviteUrl(viajeId)

  const compartirLink = async () => {
    try {
      await Share.share({
        message: `Unite al viaje en Mesh:\n${inviteUrl}`,
        url: Platform.OS === 'ios' ? inviteUrl : undefined,
        title: 'Invitación Mesh',
      })
    } catch {
      meshAlert('Error', 'No se pudo abrir el menú de compartir.')
    }
  }

  const guardarDestino = async (punto: PuntoDestino) => {
    if (!viaje || !userId) return
    if (!ubicacion) {
      meshAlert('Sin tu ubicación', 'Necesitamos saber dónde estás para calcular la ruta al destino.')
      return
    }
    setGuardandoDestino(true)
    try {
      await guardarRutaRapida(
        viaje.id,
        userId,
        viaje.tipo_actividad as TipoActividadApi,
        { lat: ubicacion.latitude, lng: ubicacion.longitude },
        punto
      )
      setDestino(punto.nombre)
      setEligiendoDestino(false)
    } catch (e) {
      meshAlert('No se pudo calcular la ruta', e instanceof Error ? e.message : undefined)
    } finally {
      setGuardandoDestino(false)
    }
  }

  const pedirArrancar = () => {
    if (Platform.OS === 'web') {
      meshAlert('Solo móvil', 'El tracking GPS está disponible en Android / iOS.')
      return
    }
    setModalPermisos(true)
  }

  const ejecutarArrancar = async () => {
    if (!viaje || !userId) return
    setModalPermisos(false)
    setArrancando(true)
    try {
      await arrancarViaje(viaje.id, userId, viaje.nombre ?? null)
      router.replace({ pathname: '/viaje/[viajeId]/live', params: { viajeId: viaje.id } })
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo arrancar el viaje.')
      setArrancando(false)
    }
  }

  const volver = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }

  if (eligiendoDestino) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <DestinoPicker
          titulo={destino ? 'Cambiar destino' : 'Agregar destino'}
          origen={ubicacion}
          onConfirm={(p) => void guardarDestino(p)}
          onCancel={() => setEligiendoDestino(false)}
          guardando={guardandoDestino}
        />
      </>
    )
  }

  const confirmados = participantes.filter((p) => p.estado === 'confirmado')
  const pendientes = participantes.filter((p) => p.estado === 'pendiente')

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Sala de espera"
        sub={viaje ? etiquetaActividad(viaje.tipo_actividad) : undefined}
        onBack={volver}
        bordered={false}
      />

      {cargando && !viaje ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, styles.qrCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.qrInner}>
                <QRCode value={inviteUrl} size={200} backgroundColor="#ffffff" color="#0f0f0f" />
              </View>
              <Text style={[styles.qrTexto, { color: theme.textDim }]}>
                Que lo escaneen desde Mesh para sumarse.
              </Text>
              <View style={styles.fila}>
                <Btn variant="secondary" icon="share-2" onPress={() => void compartirLink()} style={styles.flex}>
                  Compartir link
                </Btn>
                <Btn variant="secondary" icon="users" onPress={() => setInvitarAbierto(true)} style={styles.flex}>
                  Grupos o amigos
                </Btn>
              </View>
            </View>

            <View style={[styles.card, styles.destino, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.destinoIcono, { backgroundColor: theme.accentWeak }]}>
                <Feather name="flag" size={20} color={theme.accent} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: theme.textDim }]}>Destino</Text>
                <Text style={[styles.destinoNombre, { color: theme.text }]} numberOfLines={2}>
                  {destino ?? 'Sin destino (opcional)'}
                </Text>
              </View>
              <Btn variant="outline" size="sm" onPress={() => setEligiendoDestino(true)}>
                {destino ? 'Cambiar' : 'Agregar'}
              </Btn>
            </View>

            <Text style={[styles.seccion, { color: theme.text }]}>
              En el viaje ({confirmados.length})
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {[...confirmados, ...pendientes].map((p, i) => (
                <View
                  key={p.usuario.id}
                  style={[
                    styles.persona,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  ]}
                >
                  <Text style={[styles.personaNombre, { color: theme.text }]} numberOfLines={1}>
                    {nombreCompleto(p.usuario.nombre, p.usuario.apellido)}
                    {p.usuario.id === userId ? ' (vos)' : ''}
                  </Text>
                  {p.estado === 'confirmado' ? (
                    <Badge tone="good">LISTO</Badge>
                  ) : (
                    <Badge tone="mute">INVITADO</Badge>
                  )}
                </View>
              ))}
              {participantes.length === 0 && (
                <Text style={[styles.vacio, { color: theme.textMute }]}>Todavía no se sumó nadie.</Text>
              )}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: theme.border }]}>
            <Btn block size="xl" icon="play" onPress={pedirArrancar} loading={arrancando} disabled={!viaje || arrancando}>
              Arrancar viaje
            </Btn>
          </View>
        </>
      )}

      {userId && (
        <InvitarGruposAmigosModal
          visible={invitarAbierto}
          viajeId={viajeId}
          userId={userId}
          onClose={() => setInvitarAbierto(false)}
          onInvitados={(n) => {
            setInvitarAbierto(false)
            void cargarParticipantes()
            meshSuccess(
              n > 0 ? 'Invitaciones enviadas' : 'Sin invitaciones nuevas',
              n > 0 ? `Se invitó a ${n} ${n === 1 ? 'persona' : 'personas'}.` : 'Esas personas ya estaban en el viaje.'
            )
          }}
        />
      )}

      <Modal visible={modalPermisos} transparent animationType="fade" onRequestClose={() => setModalPermisos(false)}>
        <View style={[styles.modalBg, { backgroundColor: theme.scrim }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitulo, { color: theme.text }]}>Cómo usa Mesh tu ubicación</Text>
            <AvisoUbicacion />
            <Text style={[styles.modalBody, { color: theme.textMute }]}>{textoPermisoSistema()}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              <Btn block onPress={() => void ejecutarArrancar()}>
                Acepto y arranco el viaje
              </Btn>
              <Btn variant="secondary" block onPress={() => void Linking.openSettings()}>
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
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  qrCard: { alignItems: 'center', gap: 12 },
  qrInner: { backgroundColor: '#ffffff', padding: 14, borderRadius: 16 },
  qrTexto: { fontSize: 15, textAlign: 'center' },
  fila: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
  destino: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destinoIcono: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  destinoNombre: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  seccion: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  persona: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12 },
  personaNombre: { flex: 1, fontSize: 16, fontWeight: '600' },
  vacio: { fontSize: 15, paddingVertical: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  modalBg: { flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalBody: { fontSize: 14, lineHeight: 20, marginTop: 10 },
})
