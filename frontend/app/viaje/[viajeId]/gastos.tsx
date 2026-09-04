import { Feather } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarFallback } from '@/components/AvatarFallback'
import { Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
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
import { meshAlert } from '@/lib/meshAlert'
import { formatearEnArg } from '@/lib/tiempoArg'
import {
  listarParticipantesViaje,
  obtenerViaje,
  type ViajeDetalleApi,
  type ViajeParticipanteApi,
} from '@/lib/viajesApi'

function formatMonto(n: number): string {
  return `$${n.toFixed(2)}`
}

/** SCRUM: gastos compartidos del viaje, prorrateados por quien elige cada quien los carga. */
export default function GastosViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
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

  const soloLectura = viaje?.estado === 'finalizado'

  const candidatos = useMemo(
    () =>
      participantes
        .filter((p) => p.estado === 'confirmado')
        .map((p) => ({
          id: p.usuario.id,
          nombre: [p.usuario.nombre, p.usuario.apellido].filter(Boolean).join(' ').trim(),
        })),
    [participantes]
  )

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
  }, [candidatos])

  useEffect(() => {
    if (editandoId === null) {
      setSeleccionados(new Set(candidatos.map((c) => c.id)))
    }
  }, [candidatos, editandoId])

  const iniciarEdicion = useCallback((gasto: GastoApi) => {
    setEditandoId(gasto.id)
    setMonto(String(gasto.monto))
    setDescripcion(gasto.descripcion)
    setSeleccionados(new Set(gasto.participantes.map((p) => p.usuario_id)))
  }, [])

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
    const montoNum = Number(monto.replace(',', '.'))
    const desc = descripcion.trim()
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
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
        }
        limpiarForm()
      } catch (e) {
        meshAlert('No se pudo guardar el gasto', e instanceof Error ? e.message : 'Intentá de nuevo.')
      } finally {
        setGuardando(false)
      }
    })()
  }, [viajeId, monto, descripcion, seleccionados, editandoId, limpiarForm])

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
            void eliminarGasto(viajeId, gasto.id).catch((e) => {
              setGastos(antes)
              meshAlert('No se pudo eliminar', e instanceof Error ? e.message : 'Intentá de nuevo.')
            })
          },
        },
      ])
    },
    [viajeId, gastos, editandoId, limpiarForm]
  )

  if (!viajeId) {
    return (
      <View style={[styles.centro, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.textMute }}>Viaje no especificado.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Gastos compartidos" sub={viaje?.nombre ?? undefined} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}
        keyboardShouldPersistTaps="handled"
      >
        {cargando && gastos.length === 0 ? (
          <ActivityIndicator style={styles.spinner} color={theme.accent} />
        ) : null}

        {soloLectura ? <BalanceCard balance={balance} theme={theme} /> : null}

        {!cargando && gastos.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>Sin gastos todavía</Text>
            <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
              Registrá lo que se paga en grupo para prorratearlo al finalizar.
            </Text>
          </View>
        ) : null}

        {gastos.map((g) => (
          <GastoFila
            key={g.id}
            gasto={g}
            theme={theme}
            soloLectura={soloLectura}
            enEdicion={editandoId === g.id}
            onEditar={() => iniciarEdicion(g)}
            onEliminar={() => confirmarEliminar(g)}
          />
        ))}
      </ScrollView>

      {!soloLectura ? (
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
          {editandoId ? (
            <View style={styles.editandoRow}>
              <Text style={[styles.editandoTxt, { color: theme.accent }]}>Editando gasto</Text>
              <Pressable onPress={limpiarForm} hitSlop={8}>
                <Text style={[styles.editandoCancelar, { color: theme.textMute }]}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.altaRow}>
            <TextInput
              value={monto}
              onChangeText={setMonto}
              placeholder="Monto"
              placeholderTextColor={theme.textMute}
              keyboardType="decimal-pad"
              style={[
                styles.inputMonto,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
            />
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Descripción"
              placeholderTextColor={theme.textMute}
              maxLength={140}
              style={[
                styles.inputDescripcion,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
            />
          </View>

          {candidatos.length > 0 ? (
            <View style={styles.chips}>
              {candidatos.map((c) => {
                const activo = seleccionados.has(c.id)
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => alternarParticipante(c.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo ? theme.surface2 : theme.surface,
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
                  </Pressable>
                )
              })}
            </View>
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
        </View>
      ) : null}
    </View>
  )
}

type Theme = ReturnType<typeof useTheme>

function GastoFila({
  gasto,
  theme,
  soloLectura,
  enEdicion,
  onEditar,
  onEliminar,
}: {
  gasto: GastoApi
  theme: Theme
  soloLectura: boolean
  enEdicion: boolean
  onEditar: () => void
  onEliminar: () => void
}) {
  const fecha = formatearEnArg(gasto.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, '')

  return (
    <View
      style={[
        styles.gasto,
        {
          backgroundColor: theme.surface,
          borderColor: enEdicion ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={styles.gastoHead}>
        <Text style={[styles.gastoDescripcion, { color: theme.text }]} numberOfLines={2}>
          {gasto.descripcion}
        </Text>
        <Text style={[styles.gastoMonto, { color: theme.text }]}>{formatMonto(gasto.monto)}</Text>
      </View>

      <Text style={[styles.gastoMeta, { color: theme.textMute }]}>
        Pagó {gasto.usuario_nombre} · {fecha}
      </Text>

      <View style={styles.gastoPie}>
        <Badge tone="mute">
          {formatMonto(gasto.monto_por_persona)} × {gasto.participantes.length}{' '}
          {gasto.participantes.length === 1 ? 'persona' : 'personas'}
        </Badge>

        {!soloLectura && gasto.puede_editar ? (
          <View style={styles.gastoAcciones}>
            <Pressable onPress={onEditar} hitSlop={8} style={styles.accionBtn}>
              <Feather name="edit-2" size={16} color={theme.textMute} />
            </Pressable>
            <Pressable onPress={onEliminar} hitSlop={8} style={styles.accionBtn}>
              <Feather name="trash-2" size={16} color={theme.textMute} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function BalanceCard({ balance, theme }: { balance: BalanceGastosApi | null; theme: Theme }) {
  if (!balance) {
    return (
      <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.balanceTitulo, { color: theme.text }]}>Balance final</Text>

      {balance.transacciones.length === 0 ? (
        <Text style={[styles.balanceVacio, { color: theme.textMute }]}>
          Todos pagaron su parte: no hay nada que saldar.
        </Text>
      ) : (
        balance.transacciones.map((t, i) => (
          <Text key={i} style={[styles.balanceLinea, { color: theme.textDim }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t.de_nombre}</Text> le debe{' '}
            <Text style={{ color: theme.text, fontWeight: '700' }}>{formatMonto(t.monto)}</Text> a{' '}
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t.para_nombre}</Text>
          </Text>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spinner: { marginTop: 40 },

  lista: { padding: 16, gap: 10 },
  vacio: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  vacioTxt: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  balanceCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  balanceTitulo: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  balanceVacio: { fontSize: 14, lineHeight: 20 },
  balanceLinea: { fontSize: 14, lineHeight: 21 },

  gasto: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  gastoHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  gastoDescripcion: { flex: 1, fontSize: 15, fontWeight: '600' },
  gastoMonto: { fontSize: 15, fontWeight: '800' },
  gastoMeta: { fontSize: 12.5 },
  gastoPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  gastoAcciones: { flexDirection: 'row', gap: 4 },
  accionBtn: { padding: 4 },

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
  inputMonto: {
    width: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputDescripcion: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
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
