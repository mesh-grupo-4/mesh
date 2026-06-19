import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Modal,
  SafeAreaView,
} from 'react-native'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { Btn, useTheme, Badge, ActivityTile } from '@/components/MeshUI'
import { etiquetaActividad } from '@/lib/activityDefaults'
import {
  listarInvitacionesViajePendientes,
  listarViajesPlanificados,
  listarViajesFinalizados,
  responderInvitacionViaje,
  type InvitacionViajePendienteApi,
  type ViajePlanificadoApi,
  type ViajeFinalizadoApi,
  type TipoActividadApi,
} from '@/lib/viajesApi'

type Tab = 'mis_viajes' | 'pasados'
type FiltroActividad = 'all' | TipoActividadApi
type FiltroRol = 'todos' | 'creador' | 'participante'

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatearFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function filtrar<T extends {
  nombre?: string | null
  tipo_actividad: TipoActividadApi
  mi_estado: string | null
}>(lista: T[], q: string, actividad: FiltroActividad, rol: FiltroRol): T[] {
  const q2 = q.trim().toLowerCase()
  return lista.filter((v) => {
    if (q2 && !(v.nombre?.toLowerCase().includes(q2) ?? false)) return false
    if (actividad !== 'all' && v.tipo_actividad !== actividad) return false
    if (rol === 'creador' && v.mi_estado !== 'creador') return false
    if (rol === 'participante' && (v.mi_estado === 'creador' || v.mi_estado === null)) return false
    return true
  })
}

function Chip({
  label,
  activo,
  onPress,
  theme,
}: {
  label: string
  activo: boolean
  onPress: () => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: activo ? theme.accent : theme.border },
        activo && { backgroundColor: theme.accent },
      ]}
    >
      <Text style={[styles.chipText, { color: activo ? '#fff' : theme.textDim }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function TarjetaViaje({
  v,
  dimmed = false,
  theme,
}: {
  v: ViajePlanificadoApi
  dimmed?: boolean
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tarjeta,
        { backgroundColor: theme.surface, borderColor: theme.border },
        dimmed && styles.tarjetaDimmed,
      ]}
      onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
      activeOpacity={0.75}
    >
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={v.tipo_actividad} size={22} />
        <Text
          style={[styles.tarjetaTitulo, { color: dimmed ? theme.textDim : theme.text }]}
          numberOfLines={1}
        >
          {v.nombre ?? etiquetaActividad(v.tipo_actividad)}
        </Text>
        {dimmed ? (
          <Badge tone="mute">No realizado</Badge>
        ) : (
          <Badge tone={v.estado === 'en_curso' ? 'live' : 'accent'} pulse={v.estado === 'en_curso'}>
            {v.estado === 'en_curso' ? 'En vivo' : 'Planificado'}
          </Badge>
        )}
      </View>
      <Text style={[styles.tarjetaMeta, { color: dimmed ? theme.textMute : theme.textDim }]}>
        <Feather name="calendar" size={12} />{'  '}{formatearFecha(v.fecha_programada)}
      </Text>
      <Text style={[styles.tarjetaRol, { color: theme.textMute }]}>
        {v.mi_estado === 'creador' ? 'Organizador' : v.mi_estado === 'confirmado' ? 'Participante' : ''}
      </Text>
    </TouchableOpacity>
  )
}

function TarjetaFinalizado({
  v,
  theme,
}: {
  v: ViajeFinalizadoApi
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <TouchableOpacity
      style={[styles.tarjeta, styles.tarjetaDimmed, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
      activeOpacity={0.75}
    >
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={v.tipo_actividad} size={22} />
        <Text style={[styles.tarjetaTitulo, { color: theme.textDim }]} numberOfLines={1}>
          {v.nombre ?? etiquetaActividad(v.tipo_actividad)}
        </Text>
        <Badge tone="mute">Finalizado</Badge>
      </View>
      <Text style={[styles.tarjetaMeta, { color: theme.textMute }]}>
        <Feather name="calendar" size={12} />{'  '}{formatearFechaCorta(v.fecha_programada)}
      </Text>
      {v.fecha_fin_real && (
        <Text style={[styles.tarjetaMeta, { color: theme.textMute }]}>
          <Feather name="flag" size={12} />{'  '}Finalizó {formatearFechaCorta(v.fecha_fin_real)}
        </Text>
      )}
      <Text style={[styles.tarjetaRol, { color: theme.textMute }]}>
        {v.mi_estado === 'creador' ? 'Organizador' : 'Participante'}
      </Text>
    </TouchableOpacity>
  )
}

export default function ViajesScreen() {
  const theme = useTheme()
  const navigation = useNavigation()
  const { backendUserId, backendSyncing } = useAuth()
  const { syncKnownTripIds } = useTripRealtime()

  const [tab, setTab] = useState<Tab>('mis_viajes')
  const [viajes, setViajes] = useState<ViajePlanificadoApi[]>([])
  const [finalizados, setFinalizados] = useState<ViajeFinalizadoApi[]>([])
  const [invitaciones, setInvitaciones] = useState<InvitacionViajePendienteApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null)
  const [modalInvitaciones, setModalInvitaciones] = useState(false)
  const [noRealizadosAbierto, setNoRealizadosAbierto] = useState(false)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroActividad, setFiltroActividad] = useState<FiltroActividad>('all')
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos')

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroActividad('all')
    setFiltroRol('todos')
  }

  const filtrosActivos = busqueda.trim() !== '' || filtroActividad !== 'all' || filtroRol !== 'todos'

  // Separa planificados en futuros y vencidos (no realizados)
  const ahora = useMemo(() => Date.now(), [viajes])

  const viajesFuturos = useMemo(
    () =>
      viajes
        .filter((v) => new Date(v.fecha_programada).getTime() >= ahora || v.estado === 'en_curso')
        .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime()),
    [viajes, ahora]
  )

  const viajesNoRealizados = useMemo(
    () =>
      viajes
        .filter((v) => v.estado === 'planificado' && new Date(v.fecha_programada).getTime() < ahora)
        .sort((a, b) => new Date(b.fecha_programada).getTime() - new Date(a.fecha_programada).getTime()),
    [viajes, ahora]
  )

  // Listas filtradas
  const viajesFuturosFiltrados = useMemo(
    () => filtrar(viajesFuturos, busqueda, filtroActividad, filtroRol),
    [viajesFuturos, busqueda, filtroActividad, filtroRol]
  )
  const viajesNoRealizadosFiltrados = useMemo(
    () => filtrar(viajesNoRealizados, busqueda, filtroActividad, filtroRol),
    [viajesNoRealizados, busqueda, filtroActividad, filtroRol]
  )
  const finalizadosFiltrados = useMemo(
    () => filtrar(finalizados, busqueda, filtroActividad, filtroRol),
    [finalizados, busqueda, filtroActividad, filtroRol]
  )

  const hayPasados = finalizados.length > 0 || viajesNoRealizados.length > 0
  const hayResultadosPasados = finalizadosFiltrados.length > 0 || viajesNoRealizadosFiltrados.length > 0

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (backendSyncing) return
      let userId: string
      try {
        userId = resolveBackendUserId(backendUserId)
      } catch {
        setViajes([])
        setFinalizados([])
        setInvitaciones([])
        setCargando(false)
        setRefreshing(false)
        return
      }

      if (esRefresh) setRefreshing(true)
      else setCargando(true)

      try {
        const [planificados, pasados, pendientes] = await Promise.all([
          listarViajesPlanificados(userId),
          listarViajesFinalizados(userId),
          listarInvitacionesViajePendientes(userId),
        ])
        setViajes(planificados)
        setFinalizados(pasados)
        setInvitaciones(pendientes)
        syncKnownTripIds(
          planificados
            .filter((v) => v.mi_estado === 'confirmado' || v.mi_estado === 'creador' || v.estado === 'en_curso')
            .map((v) => v.id)
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los viajes.'
        if (!esRefresh) Alert.alert('Error', msg)
      } finally {
        setCargando(false)
        setRefreshing(false)
      }
    },
    [backendUserId, backendSyncing, syncKnownTripIds]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerBtns}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/escanear-qr')}
            hitSlop={8}
          >
            <Feather name="camera" size={22} color={theme.text} />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => setModalInvitaciones(true)}
            hitSlop={8}
          >
            <Feather
              name="bell"
              size={22}
              color={invitaciones.length > 0 ? theme.accent : theme.text}
            />
            {invitaciones.length > 0 && (
              <View style={[styles.bellBadge, { backgroundColor: theme.accent }]}>
                <Text style={styles.bellBadgeText}>
                  {invitaciones.length > 9 ? '9+' : String(invitaciones.length)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ),
    })
  }, [navigation, invitaciones.length, theme])

  const responder = async (viajeId: string, accion: 'aceptar' | 'rechazar') => {
    let userId: string
    try {
      userId = resolveBackendUserId(backendUserId)
    } catch {
      Alert.alert('Error', 'No se pudo identificar tu usuario.')
      return
    }

    setRespondiendoId(viajeId)
    try {
      await responderInvitacionViaje(viajeId, accion, userId)
      await cargar(true)
      if (accion === 'aceptar') {
        setModalInvitaciones(false)
        router.push({ pathname: '/viaje/[viajeId]', params: { viajeId } })
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder.')
    } finally {
      setRespondiendoId(null)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* Tabs internos fijos */}
      <View style={[styles.tabRow, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {(['mis_viajes', 'pasados'] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tabBtn} onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, { color: tab === t ? theme.accent : theme.textDim }]}>
              {t === 'mis_viajes' ? 'Mis viajes' : 'Viajes pasados'}
            </Text>
            {tab === t && (
              <View style={[styles.tabUnderline, { backgroundColor: theme.accent }]} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Barra de búsqueda y filtros (fija, no scrollea) */}
      <View style={[styles.filtersBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {/* Buscador */}
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={15} color={theme.textMute} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por nombre..."
            placeholderTextColor={theme.textMute}
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
              <Feather name="x-circle" size={15} color={theme.textMute} />
            </Pressable>
          )}
        </View>

        {/* Chips de actividad */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {([
            { key: 'all', label: 'Todas' },
            { key: 'moto', label: 'Moto' },
            { key: 'bici', label: 'Bici' },
            { key: 'running', label: 'Running' },
            { key: 'trekking', label: 'Trekking' },
          ] as { key: FiltroActividad; label: string }[]).map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              activo={filtroActividad === key}
              onPress={() => setFiltroActividad(key)}
              theme={theme}
            />
          ))}

          <View style={[styles.chipsDivider, { backgroundColor: theme.border }]} />

          {([
            { key: 'todos', label: 'Todos los roles' },
            { key: 'creador', label: 'Organizador' },
            { key: 'participante', label: 'Participante' },
          ] as { key: FiltroRol; label: string }[]).map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              activo={filtroRol === key}
              onPress={() => setFiltroRol(key)}
              theme={theme}
            />
          ))}

          {filtrosActivos && (
            <Pressable style={styles.limpiarBtn} onPress={limpiarFiltros}>
              <Feather name="x" size={12} color={theme.textMute} />
              <Text style={[styles.limpiarText, { color: theme.textMute }]}>Limpiar</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void cargar(true)}
              tintColor={theme.accent}
            />
          }
        >
          {/* ── MIS VIAJES ── */}
          {tab === 'mis_viajes' && (
            <>
              <Btn block size="lg" icon="plus" onPress={() => router.push('/viaje/crear')}>
                Crear viaje
              </Btn>

              {viajesFuturos.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Feather name="map" size={28} color={theme.textMute} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin viajes planificados</Text>
                  <Text style={[styles.emptyBody, { color: theme.textDim }]}>
                    Creá un viaje para configurar la ruta e invitar participantes.
                  </Text>
                </View>
              ) : viajesFuturosFiltrados.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Feather name="filter" size={28} color={theme.textMute} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin resultados</Text>
                  <Text style={[styles.emptyBody, { color: theme.textDim }]}>
                    Ningún viaje coincide con los filtros actuales.
                  </Text>
                  <Pressable onPress={limpiarFiltros} style={styles.limpiarBtnCard}>
                    <Text style={[styles.limpiarBtnCardText, { color: theme.accent }]}>Limpiar filtros</Text>
                  </Pressable>
                </View>
              ) : (
                viajesFuturosFiltrados.map((v) => (
                  <TarjetaViaje key={v.id} v={v} theme={theme} />
                ))
              )}
            </>
          )}

          {/* ── VIAJES PASADOS ── */}
          {tab === 'pasados' && (
            <>
              {!hayPasados ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Feather name="archive" size={28} color={theme.textMute} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin viajes anteriores</Text>
                  <Text style={[styles.emptyBody, { color: theme.textDim }]}>
                    Los viajes finalizados aparecerán acá.
                  </Text>
                </View>
              ) : !hayResultadosPasados ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Feather name="filter" size={28} color={theme.textMute} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin resultados</Text>
                  <Text style={[styles.emptyBody, { color: theme.textDim }]}>
                    Ningún viaje coincide con los filtros actuales.
                  </Text>
                  <Pressable onPress={limpiarFiltros} style={styles.limpiarBtnCard}>
                    <Text style={[styles.limpiarBtnCardText, { color: theme.accent }]}>Limpiar filtros</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {finalizadosFiltrados.map((v) => (
                    <TarjetaFinalizado key={v.id} v={v} theme={theme} />
                  ))}

                  {viajesNoRealizadosFiltrados.length > 0 && (
                    <View style={[styles.desplegable, { borderColor: theme.border }]}>
                      <Pressable
                        style={[styles.desplegableHeader, { backgroundColor: theme.surface2 }]}
                        onPress={() => setNoRealizadosAbierto((o) => !o)}
                      >
                        <Feather name="slash" size={15} color={theme.textMute} />
                        <Text style={[styles.desplegableTitulo, { color: theme.textDim }]}>
                          Viajes no realizados · {viajesNoRealizadosFiltrados.length}
                        </Text>
                        <Feather
                          name={noRealizadosAbierto ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={theme.textMute}
                        />
                      </Pressable>

                      {noRealizadosAbierto && (
                        <View style={styles.desplegableContent}>
                          {viajesNoRealizadosFiltrados.map((v) => (
                            <TarjetaViaje key={v.id} v={v} dimmed theme={theme} />
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Modal de invitaciones */}
      <Modal
        visible={modalInvitaciones}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalInvitaciones(false)}
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitulo, { color: theme.text }]}>
              Invitaciones{invitaciones.length > 0 ? ` · ${invitaciones.length}` : ''}
            </Text>
            <Pressable onPress={() => setModalInvitaciones(false)} hitSlop={8} style={styles.modalClose}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {invitaciones.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Feather name="bell-off" size={32} color={theme.textMute} />
                <Text style={[styles.modalEmptyText, { color: theme.textDim }]}>
                  No tenés invitaciones pendientes.
                </Text>
              </View>
            ) : (
              invitaciones.map((inv) => (
                <View
                  key={inv.viaje_id}
                  style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.tarjetaHeader}>
                    <ActivityTile activity={inv.tipo_actividad} size={20} />
                    <Text style={[styles.tarjetaTitulo, { color: theme.text }]} numberOfLines={1}>
                      {inv.nombre ?? etiquetaActividad(inv.tipo_actividad)}
                    </Text>
                  </View>
                  <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
                    <Feather name="calendar" size={12} />{'  '}{formatearFecha(inv.fecha_programada)}
                  </Text>
                  <Text style={[styles.tarjetaMeta, { color: theme.textDim }]}>
                    <Feather name="user" size={12} />{'  '}Organiza {inv.creador.nombre}
                  </Text>
                  {inv.grupo_origen && (
                    <Text style={[styles.tarjetaGrupo, { color: theme.accent }]}>
                      <Feather name="users" size={12} />{'  '}Grupo: {inv.grupo_origen.nombre}
                    </Text>
                  )}
                  <View style={styles.filaAcciones}>
                    <Btn
                      size="sm"
                      style={styles.flex1}
                      loading={respondiendoId === inv.viaje_id}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'aceptar')}
                    >
                      Aceptar
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      style={styles.flex1}
                      disabled={respondiendoId === inv.viaje_id}
                      onPress={() => void responder(inv.viaje_id, 'rechazar')}
                    >
                      Rechazar
                    </Btn>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header derecho
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 12 },

  // Tabs internos
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabBtnText: { fontSize: 14, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2.5, borderRadius: 2 },

  // Barra de filtros
  filtersBar: { borderBottomWidth: 1, paddingTop: 10, paddingBottom: 4, gap: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  chip: {
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  chipsDivider: { width: 1, height: 20, marginHorizontal: 2 },
  limpiarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  limpiarText: { fontSize: 12, fontWeight: '600' },

  // Contenido
  content: { padding: 20, paddingBottom: 40, gap: 12 },

  // Tarjetas
  tarjeta: { borderRadius: 14, padding: 14, borderWidth: 1.2, gap: 6 },
  tarjetaDimmed: { opacity: 0.75 },
  tarjetaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tarjetaTitulo: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  tarjetaMeta: { fontSize: 13, lineHeight: 18 },
  tarjetaGrupo: { fontSize: 12.5, fontWeight: '600' },
  tarjetaRol: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  filaAcciones: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex1: { flex: 1 },

  // Empty state
  emptyCard: { borderRadius: 14, borderWidth: 1.2, padding: 28, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  limpiarBtnCard: { marginTop: 4 },
  limpiarBtnCardText: { fontSize: 14, fontWeight: '700' },

  // Desplegable "Viajes no realizados"
  desplegable: { borderRadius: 14, borderWidth: 1.2, overflow: 'hidden' },
  desplegableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  desplegableTitulo: { flex: 1, fontSize: 14, fontWeight: '700' },
  desplegableContent: { padding: 12, gap: 10 },

  // Modal invitaciones
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitulo: { fontSize: 18, fontWeight: '800' },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20, paddingBottom: 40, gap: 12 },
  modalEmpty: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  modalEmptyText: { fontSize: 15, textAlign: 'center' },
})
