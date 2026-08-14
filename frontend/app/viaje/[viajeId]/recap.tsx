import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarFallback } from '@/components/AvatarFallback'
import { Badge, Btn, Chip, ChipRow, TopBar, useTheme } from '@/components/MeshUI'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { formatDurationHm, formatKm, formatPace, formatSpeedKmh } from '@/lib/format'
import {
  obtenerMetricasGrupales,
  type MetricaIntegranteApi,
  type MetricasGrupalesApi,
} from '@/lib/viajesApi'

type CriterioRecap = 'distancia' | 'velocidad' | 'tiempo'

function puestoDe(fila: MetricaIntegranteApi, criterio: CriterioRecap): number | null {
  if (criterio === 'distancia') return fila.puesto_distancia ?? null
  if (criterio === 'tiempo') return fila.puesto_tiempo ?? null
  return fila.puesto_velocidad ?? null
}

function valorDe(
  fila: MetricaIntegranteApi,
  criterio: CriterioRecap,
  tipoActividad: string
): string {
  if (criterio === 'distancia') return formatKm(fila.distancia_m)
  if (criterio === 'tiempo') return formatDurationHm(fila.tiempo_movimiento_seg)
  if (tipoActividad === 'running' || tipoActividad === 'trekking') {
    return formatPace(fila.tiempo_movimiento_seg, fila.distancia_m)
  }
  return formatSpeedKmh(fila.velocidad_promedio_kmh)
}

function tituloCriterio(criterio: CriterioRecap): string {
  if (criterio === 'distancia') return 'Más kilómetros'
  if (criterio === 'tiempo') return 'Más tiempo en movimiento'
  return 'Mejor ritmo'
}

function ordenarPorCriterio(
  filas: MetricaIntegranteApi[],
  criterio: CriterioRecap
): MetricaIntegranteApi[] {
  return [...filas].sort((a, b) => {
    const pa = puestoDe(a, criterio)
    const pb = puestoDe(b, criterio)
    if (pa == null && pb == null) return a.nombre.localeCompare(b.nombre, 'es')
    if (pa == null) return 1
    if (pb == null) return -1
    if (pa !== pb) return pa - pb
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

function pieMejora(
  mia: MetricaIntegranteApi | undefined,
  criterio: CriterioRecap,
  tipoActividad: string
): string | null {
  if (!mia) return null
  const puesto = puestoDe(mia, criterio)
  if (puesto == null) {
    return 'Esta vez no hubo traza GPS. La próxima, dejá el GPS activo.'
  }
  if (puesto === 1) {
    return 'Vas primero en este recap. En la próxima, defendé el puesto.'
  }
  const valor = valorDe(mia, criterio, tipoActividad)
  if (criterio === 'distancia') return `En la próxima, superá tus ${valor}.`
  if (criterio === 'tiempo') return `En la próxima, superá tus ${valor} en movimiento.`
  return `En la próxima, superá tu ritmo de ${valor}.`
}

export default function ViajeRecapScreen() {
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

  const [data, setData] = useState<MetricasGrupalesApi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [criterio, setCriterio] = useState<CriterioRecap>('distancia')

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const g = await obtenerMetricasGrupales(viajeId, userId)
      setData(g)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el recap')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const volver = () => router.back()

  const ordenadas = useMemo(
    () => (data ? ordenarPorCriterio(data.por_integrante, criterio) : []),
    [data, criterio]
  )
  const primero = ordenadas.find((f) => puestoDe(f, criterio) === 1)
  const resto = ordenadas.filter((f) => f.usuario_id !== primero?.usuario_id)
  const mia = data?.por_integrante.find((f) => f.usuario_id === userId)
  const tipo = data?.tipo_actividad ?? 'bici'
  const rankingOk = Boolean(data?.ranking_habilitado)

  if (!viajeId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Recap del grupo" onBack={volver} bordered={false} />
        <View style={styles.center}>
          <Text style={{ color: theme.textDim }}>Viaje no especificado.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Recap del grupo" sub="Después del cierre" onBack={volver} bordered={false} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Btn variant="outline" size="sm" icon="refresh-cw" onPress={() => void cargar()} style={{ marginTop: 14 }}>
            Reintentar
          </Btn>
        </View>
      ) : !rankingOk ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.textDim }]}>
            Este viaje no tiene recap competitivo (moto o salida individual).
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          <ChipRow>
            <Chip active={criterio === 'distancia'} onPress={() => setCriterio('distancia')}>
              Distancia
            </Chip>
            <Chip active={criterio === 'velocidad'} onPress={() => setCriterio('velocidad')}>
              Ritmo
            </Chip>
            <Chip active={criterio === 'tiempo'} onPress={() => setCriterio('tiempo')}>
              En movimiento
            </Chip>
          </ChipRow>

          {primero ? (
            <View
              style={[
                styles.heroCard,
                { backgroundColor: theme.surface, borderColor: theme.accentLine },
              ]}
            >
              <Badge tone="accent">{tituloCriterio(criterio)}</Badge>
              <AvatarFallback nombre={primero.nombre} size={56} />
              <Text style={[styles.heroNombre, { color: theme.text }]}>{primero.nombre}</Text>
              <Text style={[styles.heroValor, { color: theme.accent }]}>
                {valorDe(primero, criterio, tipo)}
              </Text>
              {primero.usuario_id === userId ? (
                <Badge tone="mute">Vos</Badge>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.nota, { color: theme.textDim }]}>
              Nadie tiene traza GPS en este criterio.
            </Text>
          )}

          {resto.map((fila) => {
            const puesto = puestoDe(fila, criterio)
            const esYo = fila.usuario_id === userId
            return (
              <View
                key={fila.usuario_id}
                style={[
                  styles.rowCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: esYo ? theme.accentLine : theme.border,
                  },
                ]}
              >
                <Text style={[styles.puesto, { color: theme.textMute }]}>
                  {puesto != null ? `#${puesto}` : '—'}
                </Text>
                <AvatarFallback nombre={fila.nombre} size={36} />
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowNombre, { color: theme.text }]} numberOfLines={1}>
                    {fila.nombre}
                    {esYo ? '  ·  Vos' : ''}
                  </Text>
                  <Text style={[styles.rowValor, { color: theme.textDim }]}>
                    {puesto == null ? 'Sin traza GPS' : valorDe(fila, criterio, tipo)}
                  </Text>
                </View>
              </View>
            )
          })}

          {pieMejora(mia, criterio, tipo) ? (
            <Text style={[styles.nota, { color: theme.textDim }]}>{pieMejora(mia, criterio, tipo)}</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  heroCard: {
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  heroNombre: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroValor: {
    fontSize: 22,
    fontWeight: '800',
  },
  rowCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  puesto: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowNombre: { fontSize: 14, fontWeight: '600' },
  rowValor: { fontSize: 13 },
  nota: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
})
