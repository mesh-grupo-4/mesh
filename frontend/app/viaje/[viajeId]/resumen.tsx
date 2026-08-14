import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ActivityTile, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import { formatDurationHm, formatHoraCorta, formatKm, formatSpeedKmh } from '@/lib/format'
import { clearTripMetrics, loadTripMetrics } from '@/lib/tripMetricsStore'
import { obtenerResumenViaje, type ResumenViajeApi } from '@/lib/viajesApi'

export default function ViajeResumenScreen() {
  const router = useRouter()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || backendUserId || DEV_USER_ID || ''
  }, [params.userId, backendUserId])

  const [resumen, setResumen] = useState<ResumenViajeApi | null>(null)
  const [distanciaLocalM, setDistanciaLocalM] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await obtenerResumenViaje(viajeId, userId)
      setResumen(r)
      // La copia local ya no hace falta: el backend tiene el dato definitivo.
      if (r.mis_metricas.distancia_m != null) {
        void clearTripMetrics(viajeId, userId)
      }
    } catch (e) {
      // Sin conexión mostramos lo que quedó guardado en el dispositivo.
      const local = await loadTripMetrics(viajeId, userId)
      setDistanciaLocalM(local.distanceM > 0 ? local.distanceM : null)
      setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const volverAlInicio = () => router.replace('/(tabs)')

  if (!viajeId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Resumen" onBack={volverAlInicio} bordered={false} />
        <View style={styles.center}>
          <Text style={{ color: theme.textDim }}>Viaje no especificado.</Text>
        </View>
      </View>
    )
  }

  const esGrupal = resumen?.viaje.es_grupal ?? false
  const esMoto = resumen?.viaje.tipo_actividad === 'moto'
  const totales = resumen?.totales
  const mias = resumen?.mis_metricas

  const comparativa = (() => {
    if (!totales?.distancia_planeada_m || totales.distancia_real_m == null) return null
    const delta =
      ((totales.distancia_real_m - totales.distancia_planeada_m) / totales.distancia_planeada_m) * 100
    const signo = delta >= 0 ? '+' : ''
    return `Planeado ${formatKm(totales.distancia_planeada_m)} · Real ${formatKm(
      totales.distancia_real_m
    )} (${signo}${delta.toFixed(1)} %)`
  })()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Resumen"
        sub={resumen ? (esGrupal ? 'Salida grupal' : 'Salida individual') : 'Cargando...'}
        onBack={volverAlInicio}
        bordered={false}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {resumen ? (
            <View style={styles.hero}>
              <ActivityTile activity={resumen.viaje.tipo_actividad} size={46} />
              <View style={styles.heroText}>
                <Text style={[styles.tripName, { color: theme.text }]} numberOfLines={2}>
                  {resumen.viaje.nombre?.trim() || (esGrupal ? 'Salida grupal' : 'Salida individual')}
                </Text>
                <View style={styles.badgeRow}>
                  <Badge tone="mute">Finalizado</Badge>
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.warnCard,
                { backgroundColor: theme.dangerWeak, borderColor: theme.danger },
              ]}
            >
              <Text style={[styles.warnText, { color: theme.text }]}>
                {distanciaLocalM != null
                  ? `No pudimos traer el resumen del servidor. Estos son datos provisionales de tu dispositivo: ${formatKm(
                      distanciaLocalM
                    )} recorridos.`
                  : `No pudimos cargar el resumen. ${error}`}
              </Text>
              <Btn variant="outline" size="sm" icon="refresh-cw" onPress={() => void cargar()}>
                Reintentar
              </Btn>
            </View>
          ) : null}

          {totales ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>El viaje</Text>
              <StatCardRow>
                <StatCard
                  icon="clock"
                  value={formatDurationHm(totales.duracion_segundos)}
                  label="Duración"
                />
                <StatCard
                  icon="activity"
                  value={formatKm(totales.distancia_real_m)}
                  label="Recorrido"
                />
                {esGrupal ? (
                  <StatCard
                    icon="users"
                    value={String(totales.cantidad_integrantes)}
                    label="Integrantes"
                  />
                ) : (
                  <StatCard
                    icon="map"
                    value={formatKm(totales.distancia_planeada_m)}
                    label="Planeado"
                  />
                )}
              </StatCardRow>

              {comparativa ? (
                <Text style={[styles.comparativa, { color: theme.textDim }]}>{comparativa}</Text>
              ) : null}
            </>
          ) : null}

          {mias ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>Tu recorrido</Text>
              <StatCardRow>
                <StatCard icon="map-pin" value={formatKm(mias.distancia_m)} label="Tu distancia" />
                <StatCard
                  icon="trending-up"
                  value={formatSpeedKmh(mias.velocidad_promedio_kmh)}
                  label={esMoto ? 'Ritmo promedio' : 'Velocidad promedio'}
                  // RN-070: en moto el dato es informativo, nunca comparativo.
                  hint={esMoto ? 'Dato informativo, no comparativo' : undefined}
                />
              </StatCardRow>

              {mias.sali_antes ? (
                <Text style={[styles.nota, { color: theme.textDim }]}>
                  Saliste del viaje a las {formatHoraCorta(mias.fecha_salida)}. Estos son tus datos
                  hasta ese momento.
                </Text>
              ) : null}
            </>
          ) : null}

          <Btn variant="primary" block icon="home" onPress={volverAlInicio} style={styles.cta}>
            Volver al inicio
          </Btn>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  tripName: {
    fontSize: 20,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  seccion: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  comparativa: {
    fontSize: 13,
    lineHeight: 18,
  },
  nota: {
    fontSize: 13,
    lineHeight: 18,
  },
  warnCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  warnText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    marginTop: 10,
  },
})
