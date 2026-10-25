import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { RecorridoMapView } from '@/components/RecorridoMapView'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { ActivityTile, TopBar, useTheme } from '@/components/MeshUI'
import { formatDurationHm, formatKm } from '@/lib/format'
import {
  obtenerRecorridoPublicado,
  type RecorridoPublicadoDetalleApi,
} from '@/lib/recorridosPublicadosApi'
import { formatearEnArg } from '@/lib/tiempoArg'

const NOMBRE_ACTIVIDAD = {
  moto: 'Moto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
} as const

export default function RecorridoPublicadoScreen() {
  const theme = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ recorridoId: string | string[] }>()
  const recorridoId = Array.isArray(params.recorridoId) ? params.recorridoId[0] : params.recorridoId

  const [recorrido, setRecorrido] = useState<RecorridoPublicadoDetalleApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recorridoId) return
    let cancelado = false
    setCargando(true)
    obtenerRecorridoPublicado(recorridoId)
      .then((r) => {
        if (!cancelado) setRecorrido(r)
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el recorrido.')
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [recorridoId])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Recorrido" onBack={() => router.back()} bordered={false} />

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error || !recorrido ? (
        <View style={styles.center}>
          <Text style={[styles.mensaje, { color: theme.danger }]}>
            {error ?? 'Este recorrido ya no está disponible.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.hero}>
            <ActivityTile activity={recorrido.tipo_actividad} size={46} />
            <View style={styles.heroText}>
              <Text style={[styles.titulo, { color: theme.text }]} numberOfLines={2}>
                {recorrido.nombre?.trim() || 'Recorrido sin nombre'}
              </Text>
              <Text style={[styles.sub, { color: theme.textDim }]}>
                {recorrido.autor.nombre} ·{' '}
                {formatearEnArg(recorrido.publicado_at, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <RecorridoMapView segmentos={recorrido.segmentos} altura={300} />

          <StatCardRow>
            <StatCard
              icon="activity"
              value={NOMBRE_ACTIVIDAD[recorrido.tipo_actividad]}
              label="Actividad"
            />
            <StatCard icon="map-pin" value={formatKm(recorrido.distancia_m)} label="Distancia" />
            <StatCard icon="clock" value={formatDurationHm(recorrido.tiempo_seg)} label="Tiempo" />
          </StatCardRow>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inner: { padding: 20, paddingBottom: 40, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, gap: 4 },
  titulo: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13 },
})
