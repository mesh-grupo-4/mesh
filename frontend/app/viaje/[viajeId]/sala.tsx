import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AjustesViajeCards } from '@/components/AjustesViajeCards'
import { AvisoUbicacion, textoPermisoSistema } from '@/components/AvisoUbicacion'
import { ClimaViajeCard } from '@/components/ClimaViajeCard'
import { ActivityTile, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { CodigoViaje } from '@/components/CodigoViaje'
import { ParametrosGrupoCard } from '@/components/ParametrosGrupoCard'
import { PrivacidadViajePanel } from '@/components/PrivacidadViajePanel'
import { SegmentTabs } from '@/components/SegmentTabs'
import { FilaResumen, TarjetaResumen } from '@/components/viaje-nuevo/Resumen'
import { ETIQUETA_MODO } from '@/lib/modoViaje'
import { DestinoPicker } from '@/components/viaje-rapido/DestinoPicker'
import { InvitarGruposAmigosModal } from '@/components/viaje-rapido/InvitarGruposAmigosModal'
import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { useUbicacionActual } from '@/hooks/useUbicacionActual'
import { useVolverInterno } from '@/hooks/useVolver'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { arrancarViaje, avisarSiOtroViajeEnCurso } from '@/lib/arrancarViaje'
import { buildInviteMessage, buildInviteUrl } from '@/lib/inviteLinks'
import { meshAlert, meshConfirmDestructive, meshSuccess, meshWarning } from '@/lib/meshAlert'
import { nombreCompleto } from '@/lib/nombres'
import { paramTexto } from '@/lib/nuevoViaje'
import { waypointsFromRutaDetalle } from '@/lib/routePayload'
import { guardarRutaRapida, type PuntoDestino } from '@/lib/rutaRapida'
import {
  eliminarViaje,
  listarParticipantesViaje,
  obtenerRuta,
  obtenerViaje,
  salirViaje,
  type TipoActividadApi,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

/** Cada cuánto se refresca quién se sumó mientras la sala está abierta. */
const MS_REFRESCO_PARTICIPANTES = 5000

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Sala de espera del "Viaje YA". El viaje ya existe en estado `planificado`
 * (así el QR sigue vigente, RN-015): el líder invita, opcionalmente agrega
 * destino y lo arranca cuando están todos.
 *
 * También la ve el participante que se sumó por QR o código, sin los controles
 * del líder (RN-030: el backend valida igual): ve quién está, el destino y la
 * configuración, y espera a que el líder arranque. Un viaje planificado para
 * más adelante se sigue viendo en su detalle.
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
  const [pestana, setPestana] = useState<'detalles' | 'config'>('detalles')
  const esLider = viaje != null && viaje.creador_id === userId
  /** Para el refresco periódico: el líder solo refresca la lista; el participante, también el viaje. */
  const esLiderRef = useRef(true)
  /** Ruta conocida: el destino se vuelve a pedir solo cuando el líder la cambia. */
  const rutaClave = useRef<string | null>(null)
  const { ubicacion } = useUbicacionActual({ activo: eligiendoDestino })

  useVolverInterno(eligiendoDestino, () => {
    if (!guardandoDestino) setEligiendoDestino(false)
  })

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

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!viajeId || !userId) return
      try {
        const v = await obtenerViaje(viajeId, userId)
        const lider = v.creador_id === userId
        esLiderRef.current = lider
        // La sala es solo antes de arrancar. Ya en curso, el líder va al mapa y el
        // participante al detalle, donde confirma que se suma (RN-029b).
        if (v.estado === 'en_curso') {
          router.replace({ pathname: lider ? '/viaje/[viajeId]/live' : '/viaje/[viajeId]', params: { viajeId } })
          return
        }
        // Participante: ya confirmado y con la hora de salida cumplida (Viaje YA).
        const participanteEnSala =
          v.mi_participacion?.estado === 'confirmado' && new Date(v.fecha_programada).getTime() <= Date.now()
        if (v.estado !== 'planificado' || (!lider && !participanteEnSala)) {
          router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId } })
          return
        }
        setViaje(v)
        const clave = `${v.ruta?.id ?? ''}:${v.ruta?.distancia_planeada_m ?? ''}`
        const tareas = [cargarParticipantes()]
        if (clave !== rutaClave.current) {
          rutaClave.current = clave
          tareas.push(cargarDestino())
        }
        await Promise.all(tareas)
      } catch (e) {
        if (silencioso) console.warn('No se pudo refrescar la sala:', e)
        else meshAlert('Error', e instanceof Error ? e.message : 'No se pudo cargar el viaje.')
      } finally {
        setCargando(false)
      }
    },
    [viajeId, userId, cargarParticipantes, cargarDestino]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
      const t = setInterval(
        () => void (esLiderRef.current ? cargarParticipantes() : cargar(true)),
        MS_REFRESCO_PARTICIPANTES
      )
      return () => clearInterval(t)
    }, [cargar, cargarParticipantes])
  )

  const inviteUrl = buildInviteUrl(viajeId)

  const compartirLink = async () => {
    try {
      await Share.share({
        message: buildInviteMessage(viajeId, viaje?.codigo_invitacion),
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

  // Un doble toque en "Acepto y arranco" no tiene que mandar dos veces el inicio.
  const arranqueEnCurso = useRef(false)
  const ejecutarArrancar = async () => {
    if (!viaje || !userId || arranqueEnCurso.current) return
    arranqueEnCurso.current = true
    setModalPermisos(false)
    setArrancando(true)
    try {
      await arrancarViaje(viaje.id, userId, viaje.nombre ?? null)
      router.replace({ pathname: '/viaje/[viajeId]/live', params: { viajeId: viaje.id } })
    } catch (e) {
      const avisado = avisarSiOtroViajeEnCurso(e, (otroId) =>
        router.replace({ pathname: '/viaje/[viajeId]/live', params: { viajeId: otroId } })
      )
      if (!avisado) meshAlert('Error', e instanceof Error ? e.message : 'No se pudo arrancar el viaje.')
      setArrancando(false)
      arranqueEnCurso.current = false
    }
  }

  /** Un viaje rápido creado por error no tiene por qué quedar como planificado. */
  const confirmarCancelar = () => {
    meshConfirmDestructive({
      title: 'Cancelar viaje',
      message: 'Se elimina el viaje para vos y para todos los que invitaste.',
      confirmLabel: 'Cancelar viaje',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        if (!viaje || !userId) return
        setArrancando(true)
        try {
          await eliminarViaje(viaje.id, userId)
          router.replace('/(tabs)')
        } catch (e) {
          meshAlert('Error', e instanceof Error ? e.message : 'No se pudo cancelar el viaje.')
          setArrancando(false)
        }
      },
    })
  }

  /** RN-029c: el participante avisa que no va; antes de arrancar no hay ubicación que cortar. */
  const confirmarNoVoy = () => {
    meshConfirmDestructive({
      title: 'Ya no voy a ir',
      message: 'El grupo va a ver que no vas a participar de este viaje.',
      confirmLabel: 'No voy',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        if (!viaje || !userId) return
        setArrancando(true)
        try {
          await salirViaje(viaje.id, userId)
          router.replace('/(tabs)')
        } catch (e) {
          meshAlert('Error', e instanceof Error ? e.message : 'No se pudo salir del viaje.')
          setArrancando(false)
        }
      },
    })
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
            <SegmentTabs
              tabs={[
                { key: 'detalles', label: 'Detalles' },
                { key: 'config', label: 'Configuración' },
              ]}
              active={pestana}
              onChange={(k) => setPestana(k as 'detalles' | 'config')}
              theme={theme}
            />

            {pestana === 'config' ? (
              <>
                {/* RN-025: el viaje rápido nace con los defaults de la actividad; el líder los ajusta acá. */}
                {viaje && userId ? (
                  esLider ? (
                    <AjustesViajeCards
                      viaje={viaje}
                      userId={userId}
                      onActualizado={(a) => setViaje((prev) => (prev ? { ...prev, ...a } : prev))}
                      plegable={false}
                    />
                  ) : (
                    <ParametrosGrupoCard
                      viaje={viaje}
                      editable={false}
                      guardando={false}
                      onGuardar={() => {}}
                      plegable={false}
                    />
                  )
                ) : null}
                {/* RN-111/112: compartir ubicación y quién la vio. */}
                <Text style={[styles.seccion, { color: theme.text }]}>Privacidad y ubicación</Text>
                <PrivacidadViajePanel viajeId={viajeId} />
              </>
            ) : (
            <>
            {/* Viaje YA: lo primero es que la gente se sume, así que el QR va arriba y destacado. */}
            <View style={[styles.card, styles.qrCard, { backgroundColor: theme.accentWeak, borderColor: theme.accent }]}>
              <View style={styles.qrInner}>
                <QRCode value={inviteUrl} size={200} backgroundColor="#ffffff" color="#0f0f0f" />
              </View>
              <CodigoViaje codigo={viaje?.codigo_invitacion} />
              <Text style={[styles.qrTexto, { color: theme.textDim }]}>
                Que lo escaneen o ingresen el código desde Mesh para sumarse.
              </Text>
              <View style={styles.fila}>
                <Btn variant="secondary" icon="share-2" onPress={() => void compartirLink()} style={styles.flex}>
                  Compartir link
                </Btn>
                {/* POST /invitaciones es solo del líder; el participante comparte el link. */}
                {esLider ? (
                  <Btn variant="secondary" icon="users" onPress={() => setInvitarAbierto(true)} style={styles.flex}>
                    Grupos o amigos
                  </Btn>
                ) : null}
              </View>
            </View>

            {/* Lo elegido, como el "Revisá y creá" de Planificar; el líder toca para cambiar. */}
            {viaje ? (
              <TarjetaResumen>
                <FilaResumen
                  leading={<ActivityTile activity={viaje.tipo_actividad} size={30} />}
                  etiqueta="Actividad"
                  valor={etiquetaActividad(viaje.tipo_actividad)}
                />
                <FilaResumen icon="tag" etiqueta="Nombre" valor={viaje.nombre?.trim() || 'Viaje rápido'} />
                <FilaResumen icon="target" etiqueta="Modo" valor={ETIQUETA_MODO[viaje.modo]} />
                <FilaResumen
                  icon="map"
                  etiqueta="Destino"
                  valor={destino ?? (esLider ? 'Sin destino (opcional)' : 'Sin destino')}
                  onPress={esLider ? () => setEligiendoDestino(true) : undefined}
                />
                <FilaResumen
                  icon="users"
                  etiqueta="Con quién"
                  valor={
                    [
                      plural(confirmados.length, 'confirmado', 'confirmados'),
                      pendientes.length > 0 ? plural(pendientes.length, 'invitado', 'invitados') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  // POST /invitaciones es solo del líder.
                  onPress={esLider ? () => setInvitarAbierto(true) : undefined}
                  ultima
                />
              </TarjetaResumen>
            ) : null}

            {/* RN-108: el pronóstico va sobre el recorrido; sin destino no hay nada que mostrar. */}
            {destino ? (
              <View style={styles.clima}>
                <ClimaViajeCard viajeId={viajeId} habilitado claveRefresco={destino} />
              </View>
            ) : null}

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
            </>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: theme.border }]}>
            {esLider ? (
              <>
                <Btn block size="xl" icon="play" onPress={pedirArrancar} loading={arrancando} disabled={!viaje || arrancando}>
                  Arrancar viaje
                </Btn>
                <Btn variant="ghost" block onPress={confirmarCancelar} disabled={!viaje || arrancando}>
                  Cancelar viaje
                </Btn>
              </>
            ) : viaje ? (
              <>
                <View style={[styles.esperando, { backgroundColor: theme.accentWeak }]}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={[styles.esperandoTexto, { color: theme.text }]}>
                    Esperando que {viaje.creador.nombre} arranque el viaje
                  </Text>
                </View>
                <Btn variant="ghost" block icon="log-out" onPress={confirmarNoVoy} disabled={arrancando} loading={arrancando}>
                  Ya no voy a ir
                </Btn>
              </>
            ) : null}
          </View>
        </>
      )}

      {userId && esLider && (
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
                Abrir ajustes de {Platform.OS === 'ios' ? 'iOS' : 'Android'}
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
  qrCard: { alignItems: 'center', gap: 12, borderWidth: 2 },
  qrInner: { backgroundColor: '#ffffff', padding: 14, borderRadius: 16 },
  qrTexto: { fontSize: 15, textAlign: 'center' },
  fila: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
  // La tarjeta de clima trae su propio margen superior; el `gap` de la lista ya separa.
  clima: { marginTop: -12 },
  seccion: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  persona: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12 },
  personaNombre: { flex: 1, fontSize: 16, fontWeight: '600' },
  vacio: { fontSize: 15, paddingVertical: 8 },
  esperando: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, marginBottom: 4 },
  esperandoTexto: { flex: 1, fontSize: 16, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 4,borderTopWidth: StyleSheet.hairlineWidth },
  modalBg: { flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalBody: { fontSize: 14, lineHeight: 20, marginTop: 10 },
})
