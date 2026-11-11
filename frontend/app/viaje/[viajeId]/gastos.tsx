import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Pressable } from '@/components/Pressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCopilot } from 'react-native-copilot'
import { AvatarFallback } from '@/components/AvatarFallback'
import { Feather } from '@expo/vector-icons'
import {
  BalanceCard,
  FiltrosGastos,
  filtrarGastos,
  GastoFila,
  ResumenGastosCard,
  type FiltroGastos,
} from '@/components/gastos/GastoCards'
import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_VIAJE_GASTOS } from '@/components/ayuda/contenidoAyuda'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import {
  actualizarGasto,
  agregarGasto,
  eliminarGasto,
  listarGastos,
  obtenerBalanceGastos,
  type BalanceGastosApi,
  type GastoApi,
} from '@/lib/gastosApi'
import { enmascararMonto, montoParaEditar, parseMonto } from '@/lib/format'
import { meshAlert } from '@/lib/meshAlert'
import { nombreCompleto } from '@/lib/nombres'
import {
  listarParticipantesViaje,
  obtenerViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

/**
 * Gastos compartidos del viaje, prorrateados entre quienes elige quien los carga.
 * Se pueden cargar, editar y borrar también con el viaje finalizado: ahí la
 * pantalla suma el balance (quién le paga a quién), que se recalcula con cada cambio.
 */
export default function GastosViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = backendUserId || DEV_USER_ID || ''
  const habilitado = Boolean(viajeId && userId.trim())

  const [viaje, setViaje] = useState<ViajeDetalleApi | null>(null)
  const [gastos, setGastos] = useState<GastoApi[]>([])
  const [balance, setBalance] = useState<BalanceGastosApi | null>(null)
  const [participantes, setParticipantes] = useState<ViajeParticipanteApi[]>([])
  const [cargando, setCargando] = useState(true)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  /** El formulario arranca plegado: la lista se queda con casi toda la pantalla. */
  const [formAbierto, setFormAbierto] = useState(false)
  const [filtro, setFiltro] = useState<FiltroGastos>('todos')

  const finalizado = viaje?.estado === 'finalizado'

  // Entre quiénes se puede repartir: el creador y los confirmados; con el viaje
  // finalizado también quien salió antes (el backend valida la lista, RN-030).
  const candidatos = useMemo(() => {
    const lista = new Map<string, string>()
    if (viaje?.creador) {
      lista.set(viaje.creador.id, nombreCompleto(viaje.creador.nombre, viaje.creador.apellido))
    }
    for (const p of participantes) {
      if (p.estado === 'confirmado' || (finalizado && p.estado === 'salido')) {
        lista.set(p.usuario.id, nombreCompleto(p.usuario.nombre, p.usuario.apellido))
      }
    }
    return [...lista].map(([id, nombre]) => ({ id, nombre }))
  }, [viaje?.creador, participantes, finalizado])

  const gastosVisibles = useMemo(() => filtrarGastos(gastos, filtro, userId), [gastos, filtro, userId])

  /** El balance no se guarda: después de cada cambio se vuelve a pedir. */
  const refrescarBalance = useCallback(() => {
    if (!viajeId || !finalizado) return
    void obtenerBalanceGastos(viajeId)
      .then(setBalance)
      .catch(() => {
        /* queda el balance anterior; se actualiza al refrescar la pantalla */
      })
  }, [viajeId, finalizado])

  const cargar = useCallback(async () => {
    if (!habilitado || !viajeId) return
    setCargando(true)
    try {
      const [v, lista] = await Promise.all([
        obtenerViaje(viajeId, userId).catch(() => null),
        listarGastos(viajeId),
      ])
      setViaje(v)
      setGastos(lista)

      if (v?.es_grupal) {
        void listarParticipantesViaje(viajeId, userId)
          .then(setParticipantes)
          .catch(() => setParticipantes([]))
      }

      if (v?.estado === 'finalizado') {
        try {
          setBalance(await obtenerBalanceGastos(viajeId))
        } catch {
          setBalance(null)
        }
      } else {
        setBalance(null)
      }
    } catch (e) {
      meshAlert(
        'No se pudieron cargar los gastos',
        e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
      )
    } finally {
      setCargando(false)
    }
  }, [habilitado, viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const limpiarForm = useCallback(() => {
    setEditandoId(null)
    setMonto('')
    setDescripcion('')
    setSeleccionados(new Set(candidatos.map((c) => c.id)))
    setFormAbierto(false)
  }, [candidatos])

  useEffect(() => {
    if (editandoId === null) {
      setSeleccionados(new Set(candidatos.map((c) => c.id)))
    }
  }, [candidatos, editandoId])

  const iniciarEdicion = useCallback((gasto: GastoApi) => {
    setEditandoId(gasto.id)
    setMonto(montoParaEditar(gasto.monto))
    setDescripcion(gasto.descripcion)
    setSeleccionados(new Set(gasto.participantes.map((p) => p.usuario_id)))
    setFormAbierto(true)
  }, [])

  const todosSeleccionados = candidatos.length > 0 && candidatos.every((c) => seleccionados.has(c.id))
  const alternarTodos = useCallback(() => {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(candidatos.map((c) => c.id)))
  }, [todosSeleccionados, candidatos])

  const alternarParticipante = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const guardar = useCallback(() => {
    if (!viajeId) return
    const montoNum = parseMonto(monto)
    const desc = descripcion.trim()
    if (montoNum == null || montoNum <= 0) {
      meshAlert('Monto inválido', 'Ingresá un monto mayor a cero.')
      return
    }
    if (!desc) {
      meshAlert('Falta la descripción', 'Contá brevemente en qué se gastó.')
      return
    }
    if (seleccionados.size === 0) {
      meshAlert('Elegí participantes', 'Seleccioná entre quiénes se reparte este gasto.')
      return
    }

    const participantesIds = [...seleccionados]
    setGuardando(true)
    void (async () => {
      try {
        if (editandoId) {
          const actualizado = await actualizarGasto(viajeId, editandoId, {
            monto: montoNum,
            descripcion: desc,
            participantesIds,
          })
          setGastos((prev) => prev.map((g) => (g.id === editandoId ? actualizado : g)))
        } else {
          const creado = await agregarGasto(viajeId, {
            monto: montoNum,
            descripcion: desc,
            participantesIds,
          })
          setGastos((prev) => [creado, ...prev])
          // Recién cargado tiene que verse: un filtro activo podría esconderlo.
          setFiltro('todos')
        }
        limpiarForm()
        refrescarBalance()
      } catch (e) {
        meshAlert('No se pudo guardar el gasto', e instanceof Error ? e.message : 'Intentá de nuevo.')
      } finally {
        setGuardando(false)
      }
    })()
  }, [viajeId, monto, descripcion, seleccionados, editandoId, limpiarForm, refrescarBalance])

  const confirmarEliminar = useCallback(
    (gasto: GastoApi) => {
      meshAlert('Eliminar gasto', `¿Borrar "${gasto.descripcion}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            if (!viajeId) return
            const antes = gastos
            setGastos((prev) => prev.filter((g) => g.id !== gasto.id))
            if (editandoId === gasto.id) limpiarForm()
            void eliminarGasto(viajeId, gasto.id)
              .then(refrescarBalance)
              .catch((e) => {
                setGastos(antes)
                meshAlert('No se pudo eliminar', e instanceof Error ? e.message : 'Intentá de nuevo.')
              })
          },
        },
      ])
    },
    [viajeId, gastos, editandoId, limpiarForm, refrescarBalance]
  )

  if (!viajeId) {
    return (
      <View style={[styles.centro, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.textMute }}>Viaje no especificado.</Text>
      </View>
    )
  }

  // `padding` en ambas plataformas: con edge-to-edge Android tampoco achica la ventana. El
  // offset negativo deja la zona segura del pie detrás del teclado, sin un hueco de más.
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior="padding"
      keyboardVerticalOffset={-insets.bottom}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Gastos compartidos"
        sub={viaje?.nombre ?? undefined}
        onBack={() => router.back()}
        onAyuda={() => start()}
      />

      <PasoAyuda {...AYUDA_VIAJE_GASTOS[0]!} estilo={styles.flex1}>
      <ScrollView
        contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {cargando && gastos.length === 0 ? (
          <ActivityIndicator style={styles.spinner} color={theme.accent} />
        ) : null}

        {gastos.length > 0 ? <ResumenGastosCard gastos={gastos} miId={userId} theme={theme} /> : null}

        {finalizado && gastos.length > 0 ? (
          <BalanceCard balance={balance} miId={userId} theme={theme} />
        ) : null}

        {!cargando && gastos.length === 0 ? (
          <View style={styles.vacio}>
            <View style={[styles.vacioIcono, { backgroundColor: theme.accentWeak }]}>
              <Feather name="dollar-sign" size={24} color={theme.accent} />
            </View>
            <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>Sin gastos todavía</Text>
            <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
              {finalizado
                ? 'Cargá lo que se pagó en grupo: el balance te dice cómo saldar las cuentas.'
                : 'Registrá lo que se paga en grupo para prorratearlo al finalizar.'}
            </Text>
          </View>
        ) : null}

        {gastos.length > 1 ? (
          <FiltrosGastos gastos={gastos} miId={userId} filtro={filtro} onChange={setFiltro} />
        ) : null}

        {gastos.length > 0 && gastosVisibles.length === 0 ? (
          <Text style={[styles.sinCoincidencias, { color: theme.textMute }]}>
            Ningún gasto coincide con este filtro.
          </Text>
        ) : null}

        {gastosVisibles.map((g) => (
          <GastoFila
            key={g.id}
            gasto={g}
            miId={userId}
            theme={theme}
            enEdicion={editandoId === g.id}
            onEditar={() => iniciarEdicion(g)}
            onEliminar={() => confirmarEliminar(g)}
          />
        ))}
      </ScrollView>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_VIAJE_GASTOS[1]!}>
        <View
          style={[
            styles.pie,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
        >
          {!formAbierto ? (
            <Btn icon="plus" onPress={() => setFormAbierto(true)} block>
              Agregar gasto
            </Btn>
          ) : (
            <>
              <View style={styles.editandoRow}>
                <Text style={[styles.editandoTxt, { color: theme.accent }]}>
                  {editandoId ? 'Editando gasto' : 'Nuevo gasto'}
                </Text>
                <Pressable onPress={limpiarForm} hitSlop={8} accessibilityRole="button">
                  <Text style={[styles.editandoCancelar, { color: theme.textMute }]}>Cancelar</Text>
                </Pressable>
              </View>

              <View style={styles.altaRow}>
                <View
                  style={[
                    styles.montoCaja,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.montoSigno, { color: theme.textDim }]}>$</Text>
                  <TextInput
                    value={monto}
                    onChangeText={(texto) => setMonto(enmascararMonto(texto))}
                    placeholder="0"
                    placeholderTextColor={theme.textMute}
                    keyboardType="decimal-pad"
                    maxLength={14}
                    accessibilityLabel="Monto"
                    style={[styles.inputMonto, { color: theme.text }]}
                  />
                </View>
                <TextInput
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="¿En qué se gastó?"
                  placeholderTextColor={theme.textMute}
                  maxLength={140}
                  accessibilityLabel="Descripción"
                  style={[
                    styles.inputDescripcion,
                    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                  ]}
                />
              </View>

              {candidatos.length > 0 ? (
                <>
                  <View style={styles.editandoRow}>
                    <Text style={[styles.repartoTxt, { color: theme.textDim }]}>
                      Se reparte entre {seleccionados.size}{' '}
                      {seleccionados.size === 1 ? 'persona' : 'personas'}
                    </Text>
                    <Pressable onPress={alternarTodos} hitSlop={8} accessibilityRole="button">
                      <Text style={[styles.editandoCancelar, { color: theme.accent }]}>
                        {todosSeleccionados ? 'Ninguno' : 'Todos'}
                      </Text>
                    </Pressable>
                  </View>
                  {/* Con mucha gente el pie no puede crecer: con el teclado arriba taparía los campos. */}
                  <ScrollView
                    style={styles.chipsScroll}
                    contentContainerStyle={styles.chips}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {candidatos.map((c) => {
                      const activo = seleccionados.has(c.id)
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => alternarParticipante(c.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: activo }}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: activo ? theme.accentWeak : theme.surface,
                              borderColor: activo ? theme.accent : theme.border,
                            },
                          ]}
                        >
                          <AvatarFallback nombre={c.nombre || '?'} size={20} />
                          <Text
                            style={[styles.chipTxt, { color: activo ? theme.accent : theme.textDim }]}
                            numberOfLines={1}
                          >
                            {c.nombre || 'Sin nombre'}
                          </Text>
                          {activo ? <Feather name="check" size={13} color={theme.accent} /> : null}
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                </>
              ) : null}

              <Btn
                icon={editandoId ? 'check' : 'plus'}
                onPress={guardar}
                disabled={guardando}
                loading={guardando}
                block
              >
                {editandoId ? 'Guardar cambios' : 'Agregar gasto'}
              </Btn>
            </>
          )}
        </View>
      </PasoAyuda>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spinner: { marginTop: 40 },

  lista: { padding: 16, gap: 10 },
  vacio: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  vacioIcono: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sinCoincidencias: { fontSize: 14, textAlign: 'center', marginTop: 16 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  vacioTxt: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  pie: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  editandoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editandoTxt: { fontSize: 13, fontWeight: '700' },
  editandoCancelar: { fontSize: 13, fontWeight: '600' },
  altaRow: { flexDirection: 'row', gap: 10 },
  montoCaja: {
    width: 132,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  montoSigno: { fontSize: 16, fontWeight: '700' },
  inputMonto: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  repartoTxt: { fontSize: 12.5, fontWeight: '600' },
  inputDescripcion: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  chipsScroll: { flexGrow: 0, maxHeight: 92 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 160,
  },
  chipTxt: { fontSize: 12.5, fontWeight: '600' },
})
