import { Feather } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { MeshApiError } from '@/lib/apiClient'
import {
  actualizarItemChecklist,
  agregarItemChecklist,
  eliminarItemChecklist,
  importarChecklist,
  listarChecklist,
  type ChecklistItemApi,
} from '@/lib/checklistApi'
import { meshAlert } from '@/lib/meshAlert'
import {
  listarViajesFinalizados,
  listarViajesPlanificados,
  obtenerViaje,
  type ViajeDetalleApi,
} from '@/lib/viajesApi'

/** SCRUM-22 / RN-026: checklist de preparativos pre-ruta, personal por integrante. */
export default function ChecklistViajeScreen() {
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
  const [items, setItems] = useState<ChecklistItemApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [paraTodos, setParaTodos] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [importVisible, setImportVisible] = useState(false)

  const esCreador = viaje != null && userId === viaje.creador_id
  const soloLectura = viaje?.estado === 'finalizado'

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setCargando(true)
    try {
      const [v, lista] = await Promise.all([
        obtenerViaje(viajeId, userId).catch(() => null),
        listarChecklist(viajeId),
      ])
      setViaje(v)
      setItems(lista)
    } catch (e) {
      meshAlert(
        'No se pudo cargar el checklist',
        e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
      )
    } finally {
      setCargando(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const total = items.length
  const listos = items.filter((i) => i.completado).length

  const alternar = useCallback(
    (item: ChecklistItemApi) => {
      if (!viajeId || soloLectura) return
      const nuevo = !item.completado
      // Optimista: la marca es la interacción más frecuente, no debe esperar la red.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completado: nuevo } : i)))
      void actualizarItemChecklist(viajeId, item.id, { completado: nuevo }).catch((e) => {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, completado: item.completado } : i))
        )
        meshAlert(
          'No se pudo actualizar el ítem',
          e instanceof Error ? e.message : 'Intentá de nuevo.'
        )
      })
    },
    [viajeId, soloLectura]
  )

  const agregar = useCallback(() => {
    if (!viajeId) return
    const limpio = texto.trim()
    if (!limpio) return
    setAgregando(true)
    void (async () => {
      try {
        const creado = await agregarItemChecklist(viajeId, {
          texto: limpio,
          paraTodos: esCreador ? paraTodos : false,
        })
        setItems((prev) => [...prev, creado])
        setTexto('')
      } catch (e) {
        const msg =
          e instanceof MeshApiError && e.code === 'ITEM_DUPLICADO'
            ? 'Ese ítem ya está en tu checklist.'
            : e instanceof Error
              ? e.message
              : 'Intentá de nuevo.'
        meshAlert('No se pudo agregar el ítem', msg)
      } finally {
        setAgregando(false)
      }
    })()
  }, [viajeId, texto, paraTodos, esCreador])

  const eliminar = useCallback(
    (item: ChecklistItemApi) => {
      if (!viajeId) return
      const antes = items
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      void eliminarItemChecklist(viajeId, item.id).catch((e) => {
        setItems(antes)
        meshAlert(
          'No se pudo quitar el ítem',
          e instanceof Error ? e.message : 'Intentá de nuevo.'
        )
      })
    },
    [viajeId, items]
  )

  const alImportar = useCallback(
    (importados: number, omitidos: number, nuevos: ChecklistItemApi[]) => {
      setItems(nuevos)
      setImportVisible(false)
      meshAlert(
        'Checklist importado',
        importados === 0
          ? 'Ese viaje no tenía ítems nuevos para traer.'
          : `Se agregaron ${importados} ${importados === 1 ? 'ítem' : 'ítems'}` +
              (omitidos > 0 ? `, y ${omitidos} ya estaban.` : '.')
      )
    },
    []
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
      <TopBar
        title="Checklist de preparativos"
        sub={viaje?.nombre ?? undefined}
        onBack={() => router.back()}
      />

      {total > 0 ? (
        <View style={[styles.progresoWrap, { borderBottomColor: theme.border }]}>
          <View style={[styles.barraFondo, { backgroundColor: theme.surface }]}>
            <View
              style={[
                styles.barraLlena,
                {
                  backgroundColor: listos === total ? theme.good : theme.accent,
                  width: `${Math.round((listos / total) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progresoTxt, { color: theme.textDim }]}>
            {listos}/{total} listos
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}
        keyboardShouldPersistTaps="handled"
      >
        {cargando && total === 0 ? (
          <ActivityIndicator style={styles.spinner} color={theme.accent} />
        ) : null}

        {!cargando && total === 0 ? (
          <View style={styles.vacio}>
            <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>Sin ítems todavía</Text>
            <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
              Agregá lo que no querés olvidarte antes de salir.
            </Text>
          </View>
        ) : null}

        {items.map((item) => (
          <ItemFila
            key={item.id}
            item={item}
            theme={theme}
            soloLectura={soloLectura}
            onToggle={() => alternar(item)}
            onEliminar={() => eliminar(item)}
          />
        ))}
      </ScrollView>

      {!soloLectura ? (
        <View
          style={[
            styles.pie,
            { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          {esCreador ? (
            <Pressable style={styles.paraTodos} onPress={() => setParaTodos((v) => !v)}>
              <Feather
                name={paraTodos ? 'check-square' : 'square'}
                size={18}
                color={paraTodos ? theme.accent : theme.textMute}
              />
              <Text style={[styles.paraTodosTxt, { color: theme.textDim }]}>
                Agregar para todo el grupo
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.altaRow}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Agregar ítem…"
              placeholderTextColor={theme.textMute}
              style={[
                styles.input,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              maxLength={120}
              onSubmitEditing={agregar}
              returnKeyType="done"
              editable={!agregando}
            />
            <Btn icon="plus" onPress={agregar} disabled={!texto.trim() || agregando} loading={agregando}>
              Agregar
            </Btn>
          </View>

          <Btn variant="ghost" block icon="download" onPress={() => setImportVisible(true)}>
            Importar de otro viaje
          </Btn>
        </View>
      ) : null}

      <ImportarSheet
        visible={importVisible}
        viajeIdActual={viajeId}
        userId={userId}
        theme={theme}
        onCerrar={() => setImportVisible(false)}
        onImportado={alImportar}
      />
    </View>
  )
}

type Theme = ReturnType<typeof useTheme>

function metaOrigen(origen: ChecklistItemApi['origen']): { texto: string; tone: 'accent' | 'mute' } | null {
  if (origen === 'lider') return { texto: 'Del grupo', tone: 'accent' }
  return null
}

function ItemFila({
  item,
  theme,
  soloLectura,
  onToggle,
  onEliminar,
}: {
  item: ChecklistItemApi
  theme: Theme
  soloLectura: boolean
  onToggle: () => void
  onEliminar: () => void
}) {
  const meta = metaOrigen(item.origen)
  return (
    <View style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        style={styles.itemMain}
        onPress={onToggle}
        disabled={soloLectura}
        hitSlop={6}
      >
        <View
          style={[
            styles.check,
            {
              borderColor: item.completado ? theme.good : theme.borderStrong,
              backgroundColor: item.completado ? theme.good : 'transparent',
            },
          ]}
        >
          {item.completado ? <Feather name="check" size={15} color={theme.onAccent} /> : null}
        </View>
        <Text
          style={[
            styles.itemTxt,
            {
              color: item.completado ? theme.textMute : theme.text,
              textDecorationLine: item.completado ? 'line-through' : 'none',
            },
          ]}
        >
          {item.texto}
        </Text>
      </Pressable>

      {meta ? <Badge tone={meta.tone}>{meta.texto}</Badge> : null}

      {!soloLectura && item.puede_editar ? (
        <Pressable onPress={onEliminar} hitSlop={8} style={styles.borrar}>
          <Feather name="trash-2" size={17} color={theme.textMute} />
        </Pressable>
      ) : null}
    </View>
  )
}

type ViajeImportable = { id: string; nombre?: string; fecha: string; estado: string }

function ImportarSheet({
  visible,
  viajeIdActual,
  userId,
  theme,
  onCerrar,
  onImportado,
}: {
  visible: boolean
  viajeIdActual: string
  userId: string
  theme: Theme
  onCerrar: () => void
  onImportado: (importados: number, omitidos: number, items: ChecklistItemApi[]) => void
}) {
  const [viajes, setViajes] = useState<ViajeImportable[]>([])
  const [cargando, setCargando] = useState(false)
  const [importandoId, setImportandoId] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setCargando(true)
    void (async () => {
      try {
        const [plan, fin] = await Promise.all([
          listarViajesPlanificados(userId).catch(() => []),
          listarViajesFinalizados(userId).catch(() => []),
        ])
        const todos: ViajeImportable[] = [
          ...plan.map((v) => ({ id: v.id, nombre: v.nombre, fecha: v.fecha_programada, estado: v.estado })),
          ...fin.map((v) => ({ id: v.id, nombre: v.nombre, fecha: v.fecha_programada, estado: v.estado })),
        ].filter((v) => v.id !== viajeIdActual)
        setViajes(todos)
      } finally {
        setCargando(false)
      }
    })()
  }, [visible, userId, viajeIdActual])

  const importar = useCallback(
    (origenId: string) => {
      setImportandoId(origenId)
      void (async () => {
        try {
          const r = await importarChecklist(viajeIdActual, origenId)
          onImportado(r.importados, r.omitidos, r.items)
        } catch (e) {
          meshAlert(
            'No se pudo importar',
            e instanceof Error ? e.message : 'Intentá con otro viaje.'
          )
        } finally {
          setImportandoId(null)
        }
      })()
    },
    [viajeIdActual, onImportado]
  )

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHead, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitulo, { color: theme.text }]}>Importar de otro viaje</Text>
            <Pressable onPress={onCerrar} hitSlop={8}>
              <Feather name="x" size={22} color={theme.textDim} />
            </Pressable>
          </View>

          <Text style={[styles.modalSub, { color: theme.textMute }]}>
            Traemos tus ítems de otro viaje. Los que ya estén, no se duplican.
          </Text>

          <ScrollView style={styles.modalLista} contentContainerStyle={{ paddingBottom: 16 }}>
            {cargando ? (
              <ActivityIndicator style={styles.spinner} color={theme.accent} />
            ) : viajes.length === 0 ? (
              <Text style={[styles.modalVacio, { color: theme.textMute }]}>
                No tenés otros viajes de dónde importar.
              </Text>
            ) : (
              viajes.map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.viajeRow, { borderColor: theme.border }]}
                  onPress={() => importar(v.id)}
                  disabled={importandoId != null}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.viajeNombre, { color: theme.text }]} numberOfLines={1}>
                      {v.nombre?.trim() || 'Viaje sin nombre'}
                    </Text>
                    <Text style={[styles.viajeMeta, { color: theme.textMute }]}>
                      {v.estado === 'finalizado' ? 'Finalizado' : 'Planificado'}
                    </Text>
                  </View>
                  {importandoId === v.id ? (
                    <ActivityIndicator color={theme.accent} />
                  ) : (
                    <Feather name="download" size={18} color={theme.textDim} />
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spinner: { marginTop: 40 },

  progresoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barraFondo: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4 },
  progresoTxt: { fontSize: 13, fontWeight: '600', minWidth: 64, textAlign: 'right' },

  lista: { padding: 16, gap: 10 },
  vacio: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  vacioTxt: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTxt: { flex: 1, fontSize: 15, fontWeight: '500' },
  borrar: { padding: 4 },

  pie: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  paraTodos: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  paraTodosTxt: { fontSize: 14, fontWeight: '500' },
  altaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    maxHeight: '80%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700' },
  modalSub: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  modalLista: { marginTop: 8 },
  modalVacio: { fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  viajeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  viajeNombre: { fontSize: 15, fontWeight: '600' },
  viajeMeta: { fontSize: 12, marginTop: 3 },
})
