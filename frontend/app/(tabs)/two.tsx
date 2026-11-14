import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'
import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Pressable } from '@/components/Pressable'
import { router, useFocusEffect } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useCopilot } from 'react-native-copilot'
import { useAuth } from '@/context/AuthContext'
import { useTripRealtime } from '@/context/TripRealtimeContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { TopBar, useTheme, Badge, ActivityTile } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { CampanitaNotificaciones } from '@/components/notificaciones/CampanitaNotificaciones'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'
import { AYUDA_VIAJES } from '@/components/ayuda/contenidoAyuda'
import { HerramientasLista } from '@/components/BarraFiltros'
import { FranjaEstado } from '@/components/FranjaEstado'
import { BotonFlotante, ESPACIO_BOTON_FLOTANTE, useBotonFlotante } from '@/components/BotonFlotante'
import { PantallaFiltrosViajes } from '@/components/viajes/PantallaFiltrosViajes'
import {
  ETIQUETA_ORDEN_PASADOS,
  FILTROS_INICIALES,
  filtrarPasados,
  filtrarProximos,
  filtrosActivos as calcularFiltrosActivos,
  limpiarFiltros as limpiarFiltrosViajes,
  ordenarFinalizados,
  type FiltrosViajes,
} from '@/lib/filtrosViajes'
import { SegmentTabs } from '@/components/SegmentTabs'
import { SelectableCard } from '@/components/SelectableCard'
import { SelectionActionBar } from '@/components/SelectionActionBar'
import { BotonSeleccionar, SelectionHeader } from '@/components/SelectionHeader'
import { useSelectionMode } from '@/hooks/useSelectionMode'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { colorModo, ETIQUETA_MODO, TONO_MODO } from '@/lib/modoViaje'
import { formatDurationHm, formatKm } from '@/lib/format'
import { aCamposArg, desdeCamposArg, formatearEnArg } from '@/lib/tiempoArg'
import {
  bulkDeleteSummary,
  formatItemList,
  runBulkDelete,
} from '@/lib/bulkDelete'
import { meshAlert, meshConfirmDestructive, meshError, meshWarning } from '@/lib/meshAlert'
import { abrirNuevoViaje } from '@/lib/nuevoViaje'
import {
  eliminarViaje,
  ocultarViaje,
  salirViaje,
  listarInvitacionesViajePendientes,
  listarViajesPlanificados,
  listarViajesFinalizados,
  type InvitacionViajePendienteApi,
  type ModoViajeApi,
  type ViajePlanificadoApi,
  type ViajeFinalizadoApi,
  type TipoActividadApi,
} from '@/lib/viajesApi'

type Tab = 'mis_viajes' | 'pasados'

function formatearFecha(iso: string): string {
  return formatearEnArg(iso, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatearFechaCorta(iso: string): string {
  return formatearEnArg(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Fin del día programado en hora argentina (RN-105). Hasta ese momento un viaje planificado
// sigue en "Mis viajes": el grupo puede estar esperando a que el líder lo inicie.
function finDelDiaArg(iso: string): number {
  const campos = aCamposArg(new Date(iso))
  campos.setHours(23, 59, 59, 999)
  return desdeCamposArg(campos).getTime()
}

function puedeEliminarViaje(v: ViajePlanificadoApi): boolean {
  return v.mi_estado === 'creador' && v.estado === 'planificado'
}

// El creador lo elimina; el participante (aunque haya salido a mitad) lo quita solo de su historial.
function puedeGestionarFinalizado(v: ViajeFinalizadoApi): boolean {
  return v.mi_estado === 'creador' || v.mi_estado === 'confirmado' || v.mi_estado === 'salido'
}

// Viaje vencido sin iniciar: el creador lo cancela; el participante se baja de él.
function puedeQuitarNoRealizado(v: ViajePlanificadoApi): boolean {
  return v.estado === 'planificado' && (v.mi_estado === 'creador' || v.mi_estado === 'confirmado')
}

/**
 * Quita un viaje de "Viajes pasados". El creador lo elimina para todos; el participante
 * de un finalizado lo oculta solo para él, y el de un no realizado se baja del viaje.
 */
async function quitarViajePasado(
  id: string,
  miEstado: string | null,
  finalizado: boolean,
  userId: string
): Promise<void> {
  if (miEstado === 'creador') {
    await eliminarViaje(id, userId)
  } else if (finalizado) {
    await ocultarViaje(id, userId)
  } else {
    await salirViaje(id, userId)
  }
}

/** Tachito por tarjeta: en iPhone no es habitual mantener apretado para seleccionar. */
function BotonQuitar({
  nombre,
  onPress,
  theme,
}: {
  nombre: string
  onPress: () => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.botonQuitar}
      accessibilityRole="button"
      accessibilityLabel={`Quitar ${nombre}`}
    >
      <Feather name="trash-2" size={18} color={theme.danger} />
    </Pressable>
  )
}

function motivoNoEliminable(v: ViajePlanificadoApi): string {
  if (v.mi_estado !== 'creador') {
    return 'Solo el creador puede cancelar un viaje planificado.'
  }
  if (v.estado === 'en_curso') {
    return 'No podés eliminar un viaje en curso. Finalizalo primero.'
  }
  return 'Este viaje no se puede eliminar.'
}

/** Modo del viaje (con su color) e individual/grupal, debajo del título de la tarjeta. */
function InfoViaje({ modo, esGrupal }: { modo: ModoViajeApi; esGrupal: boolean }) {
  return (
    <View style={styles.tarjetaInfo}>
      <Badge tone={TONO_MODO[modo]}>{ETIQUETA_MODO[modo]}</Badge>
      <Badge tone="mute">{esGrupal ? 'Grupal' : 'Individual'}</Badge>
    </View>
  )
}

function TarjetaViaje({
  v,
  dimmed = false,
  theme,
  selectionActive = false,
  selected = false,
  selectable = false,
  onEnterSelection,
  onToggle,
  onDisabledPress,
  onQuitar,
}: {
  v: ViajePlanificadoApi
  dimmed?: boolean
  theme: ReturnType<typeof useTheme>
  selectionActive?: boolean
  selected?: boolean
  selectable?: boolean
  onEnterSelection?: (id: string) => void
  onToggle?: (id: string) => void
  onDisabledPress?: () => void
  onQuitar?: () => void
}) {
  const nombre = v.nombre ?? etiquetaActividad(v.tipo_actividad)
  const modo = v.modo ?? 'recreativo'
  const contenido = (
    <>
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={v.tipo_actividad} size={22} color={colorModo(modo, theme)} />
        <Text
          style={[styles.tarjetaTitulo, { color: dimmed ? theme.textDim : theme.text }]}
          numberOfLines={1}
        >
          {nombre}
        </Text>
        {dimmed ? (
          <Badge tone="mute">No realizado</Badge>
        ) : v.estado === 'en_curso' ? (
          <Badge tone="live" pulse>
            En vivo
          </Badge>
        ) : null}
        {onQuitar && !selectionActive ? (
          <BotonQuitar nombre={nombre} onPress={onQuitar} theme={theme} />
        ) : null}
      </View>
      <InfoViaje modo={modo} esGrupal={v.es_grupal} />
      <Text style={[styles.tarjetaMeta, { color: dimmed ? theme.textMute : theme.textDim }]}>
        <Feather name="calendar" size={12} />{'  '}{formatearFecha(v.fecha_programada)}
      </Text>
      <Text style={[styles.tarjetaRol, { color: theme.textMute }]}>
        {v.mi_estado === 'creador' ? 'Organizador' : v.mi_estado === 'confirmado' ? 'Participante' : ''}
      </Text>
    </>
  )

  if (!onEnterSelection || !onToggle) {
    return (
      <Pressable
        style={[
          styles.tarjeta,
          { backgroundColor: theme.surface, borderColor: theme.border },
          dimmed && styles.tarjetaDimmed,
        ]}
        onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
      >
        {contenido}
      </Pressable>
    )
  }

  return (
    <SelectableCard
      itemId={v.id}
      selectionActive={selectionActive}
      selected={selected}
      disabled={!selectable}
      onEnterSelection={onEnterSelection}
      onToggle={onToggle}
      onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
      onDisabledPress={onDisabledPress}
      style={[
        styles.tarjeta,
        { backgroundColor: theme.surface, borderColor: theme.border },
        dimmed && styles.tarjetaDimmed,
      ]}
    >
      {contenido}
    </SelectableCard>
  )
}

function TarjetaFinalizado({
  v,
  theme,
  selectionActive = false,
  selected = false,
  selectable = false,
  onEnterSelection,
  onToggle,
  onQuitar,
}: {
  v: ViajeFinalizadoApi
  theme: ReturnType<typeof useTheme>
  selectionActive?: boolean
  selected?: boolean
  selectable?: boolean
  onEnterSelection?: (id: string) => void
  onToggle?: (id: string) => void
  onQuitar?: () => void
}) {
  const nombre = v.nombre ?? etiquetaActividad(v.tipo_actividad)
  const modo = v.modo ?? 'recreativo'
  return (
    <SelectableCard
      itemId={v.id}
      selectionActive={selectionActive}
      selected={selected}
      disabled={!selectable}
      onEnterSelection={onEnterSelection ?? (() => {})}
      onToggle={onToggle ?? (() => {})}
      onPress={() => router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })}
      style={[styles.tarjeta, styles.tarjetaDimmed, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.tarjetaHeader}>
        <ActivityTile activity={v.tipo_actividad} size={22} color={colorModo(modo, theme)} />
        <Text style={[styles.tarjetaTitulo, { color: theme.textDim }]} numberOfLines={1}>
          {nombre}
        </Text>
        {onQuitar && !selectionActive ? (
          <BotonQuitar nombre={nombre} onPress={onQuitar} theme={theme} />
        ) : null}
      </View>
      <InfoViaje modo={modo} esGrupal={v.es_grupal} />
      <Text style={[styles.tarjetaMeta, { color: theme.textMute }]}>
        <Feather name="calendar" size={12} />{'  '}{formatearFechaCorta(v.fecha_programada)}
      </Text>
      {v.fecha_fin_real && (
        <Text style={[styles.tarjetaMeta, { color: theme.textMute }]}>
          <Feather name="flag" size={12} />{'  '}Finalizó {formatearFechaCorta(v.fecha_fin_real)}
        </Text>
      )}
      {v.mi_distancia_m != null || v.mi_tiempo_movimiento_seg != null ? (
        <View style={[styles.tarjetaMetricas, { borderTopColor: theme.border }]}>
          <View style={styles.tarjetaMetrica}>
            <Text style={[styles.tarjetaMetricaValor, { color: theme.text }]}>
              {formatKm(v.mi_distancia_m)}
            </Text>
            <Text style={[styles.tarjetaMetricaLabel, { color: theme.textMute }]}>Distancia</Text>
          </View>
          <View style={styles.tarjetaMetrica}>
            <Text style={[styles.tarjetaMetricaValor, { color: theme.text }]}>
              {formatDurationHm(v.mi_tiempo_movimiento_seg)}
            </Text>
            <Text style={[styles.tarjetaMetricaLabel, { color: theme.textMute }]}>
              En movimiento
            </Text>
          </View>
          <View style={styles.tarjetaMetrica}>
            <Text style={[styles.tarjetaMetricaValor, { color: theme.text }]}>
              {etiquetaActividad(v.tipo_actividad)}
            </Text>
            <Text style={[styles.tarjetaMetricaLabel, { color: theme.textMute }]}>Actividad</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.tarjetaRol, { color: theme.textMute }]}>
        {v.mi_estado === 'creador' ? 'Organizador' : 'Participante'}
      </Text>
    </SelectableCard>
  )
}

export default function ViajesScreen() {
  const espacioTabBar = useEspacioTabBar()
  const theme = useTheme()
  const { backendUserId, backendSyncing } = useAuth()
  const { syncKnownTripIds } = useTripRealtime()
  const selection = useSelectionMode()
  const botonFlotante = useBotonFlotante()
  const { start } = useCopilot()

  const [tab, setTab] = useState<Tab>('mis_viajes')
  const [viajes, setViajes] = useState<ViajePlanificadoApi[]>([])
  const [finalizados, setFinalizados] = useState<ViajeFinalizadoApi[]>([])
  const [invitaciones, setInvitaciones] = useState<InvitacionViajePendienteApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [noRealizadosAbierto, setNoRealizadosAbierto] = useState(false)
  const [eliminandoBulk, setEliminandoBulk] = useState(false)

  useFocusEffect(
    useCallback(() => {
      return () => selection.exit()
    }, [selection.exit])
  )

  const viajesEliminables = useMemo(
    () => viajes.filter(puedeEliminarViaje),
    [viajes]
  )

  const viajesSeleccionados = viajes.filter((v) => selection.isSelected(v.id))
  const todosSeleccionados =
    viajesEliminables.length > 0 &&
    viajesEliminables.every((v) => selection.isSelected(v.id))

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      selection.clear()
      return
    }
    selection.selectAll(viajesEliminables.map((v) => v.id))
  }

  const confirmarEliminarSeleccionados = () => {
    if (selection.count === 0) return

    const nombres = viajesSeleccionados.map(
      (v) => v.nombre ?? etiquetaActividad(v.tipo_actividad)
    )

    meshConfirmDestructive({
      title: 'Cancelar viajes',
      message: `¿Cancelar ${selection.count === 1 ? 'este viaje planificado' : `estos ${selection.count} viajes planificados`} (${formatItemList(nombres)})? Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar (${selection.count})`,
      onConfirm: () => void ejecutarEliminarBulk(),
    })
  }

  const ejecutarEliminarBulk = async () => {
    setEliminandoBulk(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const items = viajesSeleccionados.map((v) => ({
        id: v.id,
        label: v.nombre ?? etiquetaActividad(v.tipo_actividad),
      }))

      const result = await runBulkDelete(items, async (item) => {
        await eliminarViaje(item.id, userId)
      })

      const idsOk = new Set(
        items.filter((i) => !result.failed.some((f) => f.id === i.id)).map((i) => i.id)
      )
      setViajes((prev) => prev.filter((v) => !idsOk.has(v.id)))
      selection.exit()

      if (result.failed.length > 0) {
        meshAlert('Resultado parcial', bulkDeleteSummary(result, 'viaje'), [{ text: 'Entendido' }])
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo completar la eliminación.')
    } finally {
      setEliminandoBulk(false)
    }
  }

  const confirmarEliminarFinalizados = () => {
    if (selection.count === 0) return
    meshConfirmDestructive({
      title: 'Quitar viajes',
      message: `¿Quitar ${selection.count === 1 ? 'este viaje' : `estos ${selection.count} viajes`} de tu historial? Esta acción no se puede deshacer.`,
      confirmLabel: `Quitar (${selection.count})`,
      onConfirm: () => void ejecutarEliminarBulkPasados(),
    })
  }

  const ejecutarEliminarBulkPasados = async () => {
    setEliminandoBulk(true)
    try {
      const userId = resolveBackendUserId(backendUserId)

      // Lookup de mi_estado para cualquier viaje seleccionado (finalizado o no-realizado)
      const miEstadoMap = new Map<string, string | null>([
        ...finalizados.map((v) => [v.id, v.mi_estado] as const),
        ...viajesNoRealizados.map((v) => [v.id, v.mi_estado] as const),
      ])
      const idsFinalizados = new Set(finalizados.map((v) => v.id))

      const items = pasadosGestionables
        .filter((v) => selection.isSelected(v.id))
        .map((v) => ({
          id: v.id,
          label: v.nombre ?? etiquetaActividad(v.tipo_actividad),
        }))

      const result = await runBulkDelete(items, (item) =>
        quitarViajePasado(
          item.id,
          miEstadoMap.get(item.id) ?? null,
          idsFinalizados.has(item.id),
          userId
        )
      )

      const idsOk = new Set(
        items.filter((i) => !result.failed.some((f) => f.id === i.id)).map((i) => i.id)
      )
      setFinalizados((prev) => prev.filter((v) => !idsOk.has(v.id)))
      setViajes((prev) => prev.filter((v) => !idsOk.has(v.id)))
      selection.exit()

      if (result.failed.length > 0) {
        meshAlert('Resultado parcial', bulkDeleteSummary(result, 'viaje'), [{ text: 'Entendido' }])
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo completar la operación.')
    } finally {
      setEliminandoBulk(false)
    }
  }

  /** Quitar un solo viaje con el tachito de su tarjeta, sin entrar en modo selección. */
  const confirmarQuitarUno = (
    v: { id: string; nombre?: string | null; tipo_actividad: TipoActividadApi; mi_estado: string | null },
    finalizado: boolean
  ) => {
    const nombre = v.nombre ?? etiquetaActividad(v.tipo_actividad)
    const esCreador = v.mi_estado === 'creador'
    meshConfirmDestructive({
      title: esCreador ? 'Eliminar viaje' : 'Quitar viaje',
      message: esCreador
        ? `Sos el organizador de "${nombre}": se elimina para todo el grupo. Esta acción no se puede deshacer.`
        : `¿Quitar "${nombre}" de tu historial? El resto del grupo lo sigue viendo.`,
      confirmLabel: esCreador ? 'Eliminar' : 'Quitar',
      onConfirm: async () => {
        try {
          await quitarViajePasado(v.id, v.mi_estado, finalizado, resolveBackendUserId(backendUserId))
          setFinalizados((prev) => prev.filter((f) => f.id !== v.id))
          setViajes((prev) => prev.filter((p) => p.id !== v.id))
        } catch (e: unknown) {
          meshError('Error', e instanceof Error ? e.message : 'No se pudo quitar el viaje.')
        }
      },
    })
  }

  // Filtros: se comparten entre pestañas; cada una usa los que le aplican.
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosViajes>(FILTROS_INICIALES)
  const [pantallaFiltros, setPantallaFiltros] = useState(false)

  const filtrosAplicados = useMemo(() => calcularFiltrosActivos(filtros, tab), [filtros, tab])

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltros(limpiarFiltrosViajes)
  }

  const filtrosActivos = busqueda.trim() !== '' || filtrosAplicados.length > 0

  // Separa planificados en futuros y vencidos (no realizados)
  const ahora = useMemo(() => Date.now(), [viajes])

  const viajesFuturos = useMemo(
    () =>
      viajes
        .filter((v) => finDelDiaArg(v.fecha_programada) >= ahora || v.estado === 'en_curso')
        .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime()),
    [viajes, ahora]
  )

  const viajesNoRealizados = useMemo(
    () =>
      viajes
        .filter((v) => v.estado === 'planificado' && finDelDiaArg(v.fecha_programada) < ahora)
        .sort((a, b) => new Date(b.fecha_programada).getTime() - new Date(a.fecha_programada).getTime()),
    [viajes, ahora]
  )

  const pasadosGestionables = useMemo(
    () => [
      ...finalizados.filter(puedeGestionarFinalizado),
      ...viajesNoRealizados.filter(puedeQuitarNoRealizado),
    ],
    [finalizados, viajesNoRealizados]
  )
  const todosPasadosSeleccionados =
    pasadosGestionables.length > 0 &&
    pasadosGestionables.every((v) => selection.isSelected(v.id))

  const toggleSeleccionarTodosPasados = () => {
    if (todosPasadosSeleccionados) {
      selection.clear()
      return
    }
    selection.selectAll(pasadosGestionables.map((v) => v.id))
  }

  // Listas filtradas
  const viajesFuturosFiltrados = useMemo(
    () => filtrarProximos(viajesFuturos, filtros, busqueda),
    [viajesFuturos, filtros, busqueda]
  )
  const viajesNoRealizadosFiltrados = useMemo(
    () => filtrarPasados(viajesNoRealizados, filtros, busqueda),
    [viajesNoRealizados, filtros, busqueda]
  )
  const finalizadosFiltrados = useMemo(
    () => ordenarFinalizados(filtrarPasados(finalizados, filtros, busqueda), filtros.ordenPasados),
    [finalizados, filtros, busqueda]
  )

  // Para la hoja: cuántos viajes dejaría ver un borrador antes de aplicarlo.
  const contarConFiltros = useCallback(
    (f: FiltrosViajes) =>
      tab === 'mis_viajes'
        ? filtrarProximos(viajesFuturos, f, busqueda).length
        : filtrarPasados(finalizados, f, busqueda).length +
          filtrarPasados(viajesNoRealizados, f, busqueda).length,
    [tab, viajesFuturos, finalizados, viajesNoRealizados, busqueda]
  )
  const totalPestana =
    tab === 'mis_viajes' ? viajesFuturos.length : finalizados.length + viajesNoRealizados.length
  const visiblesPestana =
    tab === 'mis_viajes'
      ? viajesFuturosFiltrados.length
      : finalizadosFiltrados.length + viajesNoRealizadosFiltrados.length

  const sufijoOrden =
    tab === 'pasados' && filtros.ordenPasados !== 'recientes'
      ? ` · ${ETIQUETA_ORDEN_PASADOS[filtros.ordenPasados]}`
      : ''
  const resumenLista = cargando
    ? undefined
    : (filtrosActivos
        ? `Mostrando ${visiblesPestana} de ${totalPestana}`
        : `${totalPestana} ${totalPestana === 1 ? 'viaje' : 'viajes'}`) + sufijoOrden

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
        // Una invitación sin responder no es un viaje propio: se muestra solo en la campanita.
        setViajes(planificados.filter((v) => v.mi_estado !== 'pendiente'))
        setFinalizados(pasados)
        setInvitaciones(pendientes)
        syncKnownTripIds(
          planificados
            .filter((v) => v.mi_estado === 'confirmado' || v.mi_estado === 'creador' || v.estado === 'en_curso')
            .map((v) => v.id)
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los viajes.'
        if (!esRefresh) meshError('Error', msg)
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

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollViewAyuda
        onScroll={botonFlotante.onScroll}
        contentContainerStyle={[styles.scroll, { paddingBottom: espacioTabBar + ESPACIO_BOTON_FLOTANTE }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        <TopBar
          title="Viajes"
          raiz
          bordered={false}
          onAyuda={() => start()}
          right={
            <PasoAyuda {...AYUDA_VIAJES[0]!}>
              <View style={styles.headerBtns}>
                <Pressable
                  style={({ pressed }) => [
                    styles.headerBtn,
                    {
                      backgroundColor: pressed ? theme.surface2 : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => router.push('/escanear-qr')}
                  accessibilityRole="button"
                  accessibilityLabel="Escanear QR de invitación"
                  hitSlop={8}
                >
                  <Feather name="camera" size={19} color={theme.text} />
                </Pressable>
                <CampanitaNotificaciones
                  pendientes={invitaciones.length}
                  etiqueta="Invitaciones a viajes"
                  onPress={() => router.push('/viaje/invitaciones')}
                />
              </View>
            </PasoAyuda>
          }
        />

        {/* Pestañas internas: scrollean con todo lo demás, nada queda fijo. */}
        <PasoAyuda {...AYUDA_VIAJES[1]!}>
          <View style={styles.segmentWrap}>
            <SegmentTabs
              tabs={[
                { key: 'mis_viajes', label: 'Planificados' },
                { key: 'pasados', label: 'Finalizados' },
              ]}
              active={tab}
              onChange={(key) => {
                selection.exit()
                setTab(key as Tab)
              }}
              theme={theme}
            />
          </View>
        </PasoAyuda>

        <PasoAyuda {...AYUDA_VIAJES[2]!}>
          <HerramientasLista
            resumen={resumenLista}
            busqueda={{
              value: busqueda,
              onChangeText: setBusqueda,
              placeholder: 'Buscar por nombre o actividad...',
              accessibilityLabel: 'Buscar viajes',
              maxLength: 60,
            }}
            filtros={{
              cantidad: filtrosAplicados.length,
              onPress: () => setPantallaFiltros(true),
              onLimpiar: limpiarFiltros,
            }}
          />
        </PasoAyuda>

        {cargando ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
        <View style={styles.content}>
          {/* ── MIS VIAJES ── */}
          {tab === 'mis_viajes' && (
            <>
              <BotonSeleccionar
                visible={!selection.active && viajesEliminables.length > 0}
                onPress={() => selection.enter()}
              />
              <SelectionHeader
                visible={selection.active}
                allSelected={todosSeleccionados}
                onToggleAll={toggleSeleccionarTodos}
                onCancel={selection.exit}
              />

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
                  <TarjetaViaje
                    key={v.id}
                    v={v}
                    theme={theme}
                    selectionActive={selection.active}
                    selected={selection.isSelected(v.id)}
                    selectable={puedeEliminarViaje(v)}
                    onEnterSelection={selection.enter}
                    onToggle={selection.toggle}
                    onDisabledPress={() =>
                      meshWarning('No se puede eliminar', motivoNoEliminable(v))
                    }
                  />
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
                  <BotonSeleccionar
                    visible={!selection.active && pasadosGestionables.length > 0}
                    onPress={() => selection.enter()}
                  />
                  <SelectionHeader
                    visible={selection.active && tab === 'pasados'}
                    allSelected={todosPasadosSeleccionados}
                    onToggleAll={toggleSeleccionarTodosPasados}
                    onCancel={selection.exit}
                  />
                  {finalizadosFiltrados.map((v) => (
                    <TarjetaFinalizado
                      key={v.id}
                      v={v}
                      theme={theme}
                      selectionActive={selection.active}
                      selected={selection.isSelected(v.id)}
                      selectable={puedeGestionarFinalizado(v)}
                      onEnterSelection={selection.enter}
                      onToggle={selection.toggle}
                      onQuitar={
                        puedeGestionarFinalizado(v) ? () => confirmarQuitarUno(v, true) : undefined
                      }
                    />
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
                            <TarjetaViaje
                              key={v.id}
                              v={v}
                              dimmed
                              theme={theme}
                              selectionActive={selection.active}
                              selected={selection.isSelected(v.id)}
                              selectable={puedeQuitarNoRealizado(v)}
                              onEnterSelection={selection.enter}
                              onToggle={selection.toggle}
                              onDisabledPress={() =>
                                meshWarning('No se puede quitar', 'Este viaje no se puede quitar de tu lista.')
                              }
                              onQuitar={
                                puedeQuitarNoRealizado(v) ? () => confirmarQuitarUno(v, false) : undefined
                              }
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
        )}
      </ScrollViewAyuda>

      <FranjaEstado />

      <BotonFlotante
        icono="map"
        label="Nuevo viaje"
        extendido={botonFlotante.extendido}
        onPress={() => abrirNuevoViaje()}
        visible={!selection.active}
        ayuda={AYUDA_VIAJES[3]}
      />

      <PantallaFiltrosViajes
        visible={pantallaFiltros}
        pestana={tab}
        filtros={filtros}
        contar={contarConFiltros}
        onAplicar={(f) => {
          setFiltros(f)
          setPantallaFiltros(false)
        }}
        onCerrar={() => setPantallaFiltros(false)}
      />

      <SelectionActionBar
        visible={selection.active && (tab === 'mis_viajes' || tab === 'pasados')}
        count={selection.count}
        deleting={eliminandoBulk}
        onCancel={selection.exit}
        onDelete={tab === 'mis_viajes' ? confirmarEliminarSeleccionados : confirmarEliminarFinalizados}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header derecho
  // Mismo formato que `CampanitaNotificaciones` (botón redondo con borde).
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs internos
  segmentWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },

  // Contenido
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },

  // Tarjetas
  tarjeta: { borderRadius: 14, padding: 14, borderWidth: 1.2, gap: 6 },
  tarjetaDimmed: { opacity: 0.75 },
  tarjetaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonQuitar: { padding: 4, marginLeft: 2 },
  tarjetaTitulo: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  tarjetaMeta: { fontSize: 13, lineHeight: 18 },
  tarjetaInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tarjetaGrupo: { fontSize: 12.5, fontWeight: '600' },
  tarjetaRol: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  tarjetaMetricas: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  tarjetaMetrica: { flex: 1, gap: 2 },
  tarjetaMetricaValor: { fontSize: 15, fontWeight: '800' },
  tarjetaMetricaLabel: { fontSize: 11, fontWeight: '600' },
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
})
