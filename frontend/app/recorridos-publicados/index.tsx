import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Chip, ChipRow, TopBar, useTheme, ActivityTile } from '@/components/MeshUI'
import { formatDurationHm, formatKm } from '@/lib/format'
import {
  listarRecorridosPublicados,
  type RecorridoPublicadoApi,
} from '@/lib/recorridosPublicadosApi'
import { formatearEnArg } from '@/lib/tiempoArg'
import type { TipoActividadApi } from '@/lib/viajesApi'

const FILTROS: { id: TipoActividadApi | null; label: string }[] = [
  { id: null, label: 'Todos' },
  { id: 'moto', label: 'Moto' },
  { id: 'bici', label: 'Bici' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
  { id: 'otro', label: 'Otro' },
]

export default function RecorridosPublicadosScreen() {
  const theme = useTheme()
  const router = useRouter()
  const [filtro, setFiltro] = useState<TipoActividadApi | null>(null)
  const [recorridos, setRecorridos] = useState<RecorridoPublicadoApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (esRefresh = false) => {
      if (esRefresh) setRefreshing(true)
      else setCargando(true)
      setError(null)
      try {
        setRecorridos(await listarRecorridosPublicados({ tipoActividad: filtro ?? undefined }))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los recorridos.')
      } finally {
        setCargando(false)
        setRefreshing(false)
      }
    },
    [filtro]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Recorridos de la comunidad" onBack={() => router.back()} bordered={false} />

      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void cargar(true)}
            tintColor={theme.accent}
          />
        }
      >
        <ChipRow>
          {FILTROS.map((f) => (
            <Chip key={f.label} active={filtro === f.id} onPress={() => setFiltro(f.id)}>
              {f.label}
            </Chip>
          ))}
        </ChipRow>

        {cargando ? (
          <ActivityIndicator color={theme.accent} size="large" style={styles.spinner} />
        ) : error ? (
          <Text style={[styles.mensaje, { color: theme.danger }]}>{error}</Text>
        ) : recorridos.length === 0 ? (
          <Text style={[styles.mensaje, { color: theme.textMute }]}>
            Todavía no hay recorridos publicados. Publicá uno desde el resumen de un viaje
            finalizado.
          </Text>
        ) : (
          recorridos.map((r) => (
            <Pressable
              key={r.id}
              onPress={() =>
                router.push({
                  pathname: '/recorridos-publicados/[recorridoId]',
                  params: { recorridoId: r.id },
                })
              }
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <ActivityTile activity={r.tipo_actividad} size={44} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitulo, { color: theme.text }]} numberOfLines={1}>
                  {r.nombre?.trim() || 'Recorrido sin nombre'}
                </Text>
                <Text style={[styles.cardSub, { color: theme.textDim }]} numberOfLines={1}>
                  {formatKm(r.distancia_m)} · {formatDurationHm(r.tiempo_seg)}
                </Text>
                <Text style={[styles.cardSub, { color: theme.textMute }]} numberOfLines={1}>
                  {r.autor.nombre} ·{' '}
                  {formatearEnArg(r.publicado_at, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 20, paddingBottom: 40, gap: 12 },
  spinner: { marginTop: 48 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitulo: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 13 },
})
