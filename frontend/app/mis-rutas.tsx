import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'

import { Btn, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatDurationHm, formatKm } from '@/lib/format'
import { meshAlert } from '@/lib/meshAlert'
import {
  eliminarRutaPlantilla,
  listarRutasPlantilla,
  type RutaPlantillaResumenApi,
} from '@/lib/rutasCompartidasApi'

export default function MisRutasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { backendUserId } = useAuth()
  const [items, setItems] = useState<RutaPlantillaResumenApi[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const data = await listarRutasPlantilla(userId)
      setItems(data)
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron cargar tus rutas')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const eliminar = (item: RutaPlantillaResumenApi) => {
    meshAlert('Eliminar plantilla', `¿Eliminar “${item.nombre}” de tus rutas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const userId = resolveBackendUserId(backendUserId)
              await eliminarRutaPlantilla(item.id, userId)
              setItems((prev) => prev.filter((p) => p.id !== item.id))
            } catch (e) {
              meshAlert('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
            }
          })()
        },
      },
    ])
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Mis rutas' }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textDim }]}>
              Todavía no guardaste rutas compartidas.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/viaje/crear',
                    params: { plantillaId: item.id, tipoActividad: item.tipo_actividad },
                  })
                }
              >
                <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
                  {item.nombre}
                </Text>
                <Text style={[styles.meta, { color: theme.textDim }]}>
                  {item.tipo_actividad}
                  {item.distancia_planeada_m != null
                    ? ` · ${formatKm(item.distancia_planeada_m)}`
                    : ''}
                  {item.tiempo_estimado_seg != null
                    ? ` · ${formatDurationHm(item.tiempo_estimado_seg)}`
                    : ''}
                </Text>
              </Pressable>
              <View style={styles.row}>
                <Btn
                  variant="primary"
                  size="sm"
                  icon="plus"
                  onPress={() =>
                    router.push({
                      pathname: '/viaje/crear',
                      params: { plantillaId: item.id, tipoActividad: item.tipo_actividad },
                    })
                  }
                >
                  Usar en viaje
                </Btn>
                <Pressable onPress={() => eliminar(item)} hitSlop={12} style={styles.trash}>
                  <Feather name="trash-2" size={18} color={theme.danger} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 12 },
  empty: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  nombre: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trash: { padding: 8 },
})
