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
import { RecorridoMapView } from '@/components/RecorridoMapView'
import { ActivityTile, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import {
  formatDurationHm,
  formatHoraCorta,
  formatKm,
  formatPace,
  formatSpeedKmh,
} from '@/lib/format'
import { clearTripMetrics, loadTripMetrics } from '@/lib/tripMetricsStore'
import {
  obtenerMetricasGrupales,
  obtenerRecorrido,
  obtenerResumenViaje,
  type MetricasGrupalesApi,
  type ResumenViajeApi,
} from '@/lib/viajesApi'

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
  const [grupales, setGrupales] = useState<MetricasGrupalesApi | null>(null)
  const [distanciaLocalM, setDistanciaLocalM] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // US2: traza GPS realmente recorrida. Se carga aparte del resumen para que un
  // viaje sin GPS no demore ni rompa el resto de la pantalla.
  const [recorrido, setRecorrido] = useState<[number, number][]>([])
  const [cargandoRecorrido, setCargandoRecorrido] = useState(true)

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await obtenerResumenViaje(viajeId, userId)
      setResumen(r)
      if (r.mis_metricas.distancia_m != null) {
        void clearTripMetrics(viajeId, userId)
      }
      if (r.viaje.es_grupal) {
        try {
          const g = await obtenerMetricasGrupales(viajeId, userId)
          setGrupales(g)
        } catch {
          // Las métricas grupales son adicionales; si fallan, seguimos mostrando el resumen.
        }
      }
    } catch (e) {
      const local = await loadTripMetrics(viajeId, userId)
      setDistanciaLocalM(local.distanceM > 0 ? local.distanceM : null)
      setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    let cancelado = false
    setCargandoRecorrido(true)
    void obtenerRecorrido(viajeId)
      .then((r) => {
        if (!cancelado) setRecorrido(r.puntos)
      })
      .catch(() => {
        if (!cancelado) setRecorrido([])
      })
      .finally(() => {
        if (!cancelado) setCargandoRecorrido(false)
      })
    return () => {
      cancelado = true
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
      ((totales.distancia_real_m - totales.distancia_planeada_m) / totales.distancia_planeada_m) *
      100
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
                  ? `No pudimos traer el resumen del servidor. Estos son datos provisionales de tu dispositivo: ${formatKm(distanciaLocalM)} recorridos.`
                  : `No pudimos cargar el resumen. ${error}`}
              </Text>
              <Btn variant="outline" size="sm" icon="refresh-cw" onPress={() => void cargar()}>
                Reintentar
              </Btn>
            </View>
          ) : null}

          {/* ── Mapa del recorrido realizado (US2) ── */}
          <RecorridoMapView puntos={recorrido} cargando={cargandoRecorrido} />

          {/* ── El viaje (totales grupales) ── */}
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

              {totales.cantidad_paradas > 0 ? (
                <StatCardRow>
                  <StatCard
                    icon="map-pin"
                    value={String(totales.cantidad_paradas)}
                    label="Paradas"
                  />
                </StatCardRow>
              ) : null}

              {comparativa ? (
                <Text style={[styles.comparativa, { color: theme.textDim }]}>{comparativa}</Text>
              ) : null}
            </>
          ) : null}

          {/* ── Tu recorrido (métricas individuales) ── */}
          {mias ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>Tu recorrido</Text>
              <StatCardRow>
                <StatCard icon="map-pin" value={formatKm(mias.distancia_m)} label="Tu distancia" />
                <StatCard
                  icon="trending-up"
                  value={formatSpeedKmh(mias.velocidad_promedio_kmh)}
                  label={esMoto ? 'Ritmo promedio' : 'Vel. promedio'}
                  hint={esMoto ? 'Dato informativo, no comparativo' : undefined}
                />
                {!esMoto ? (
                  <StatCard
                    icon="zap"
                    value={formatSpeedKmh(mias.velocidad_maxima_kmh)}
                    label="Vel. máxima"
                  />
                ) : null}
              </StatCardRow>

              {!esMoto ? (
                <StatCardRow>
                  <StatCard
                    icon="watch"
                    value={formatPace(mias.tiempo_movimiento_seg, mias.distancia_m)}
                    label="Ritmo"
                  />
                  <StatCard
                    icon="pause-circle"
                    value={formatDurationHm(
                      totales?.duracion_segundos != null && mias.tiempo_movimiento_seg != null
                        ? Math.max(0, totales.duracion_segundos - mias.tiempo_movimiento_seg)
                        : null
                    )}
                    label="Tiempo detenido"
                  />
                </StatCardRow>
              ) : null}

              {mias.sali_antes ? (
                <Text style={[styles.nota, { color: theme.textDim }]}>
                  Saliste del viaje a las {formatHoraCorta(mias.fecha_salida)}. Estos son tus datos
                  hasta ese momento.
                </Text>
              ) : null}
            </>
          ) : null}

          {/* ── El grupo (métricas por integrante) ── */}
          {esGrupal && grupales && grupales.por_integrante.length > 0 ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>El grupo</Text>
              <View
                style={[
                  styles.grupoCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {grupales.por_integrante.map((integrante, idx) => (
                  <View key={integrante.usuario_id}>
                    {idx > 0 ? (
                      <View style={[styles.separador, { backgroundColor: theme.border }]} />
                    ) : null}
                    <IntegranteRow
                      integrante={integrante}
                      rankingHabilitado={grupales.ranking_habilitado}
                      tipoActividad={grupales.tipo_actividad}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {esGrupal && grupales?.ranking_habilitado ? (
            <Btn
              variant="secondary"
              block
              icon="award"
              onPress={() =>
                router.push({ pathname: '/viaje/[viajeId]/recap', params: { viajeId } })
              }
              style={styles.cta}
            >
              Recap del grupo
            </Btn>
          ) : null}

          <Btn
            variant="outline"
            block
            icon="trending-up"
            onPress={() =>
              router.push({ pathname: '/viaje/[viajeId]/metricas', params: { viajeId } })
            }
            style={styles.cta}
          >
            Ver métricas detalladas
          </Btn>

          <Btn variant="primary" block icon="home" onPress={volverAlInicio}>
            Volver al inicio
          </Btn>
        </ScrollView>
      )}
    </View>
  )
}

type IntegranteRowProps = {
  integrante: MetricasGrupalesApi['por_integrante'][number]
  rankingHabilitado: boolean
  tipoActividad: string
}

function IntegranteRow({ integrante, rankingHabilitado, tipoActividad }: IntegranteRowProps) {
  const theme = useTheme()
  const esPaceActivity = tipoActividad === 'running' || tipoActividad === 'trekking'

  return (
    <View style={styles.integranteRow}>
      <AvatarFallback nombre={integrante.nombre} size={36} />
      <View style={styles.integranteInfo}>
        <Text style={[styles.integranteNombre, { color: theme.text }]} numberOfLines={1}>
          {integrante.nombre}
        </Text>
        <View style={styles.integranteStats}>
          <Text style={[styles.integranteStat, { color: theme.textDim }]}>
            {formatKm(integrante.distancia_m)}
          </Text>
          {rankingHabilitado && integrante.distancia_m != null ? (
            <>
              {esPaceActivity ? (
                <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                  {formatPace(integrante.tiempo_movimiento_seg, integrante.distancia_m)}
                </Text>
              ) : (
                <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                  {formatSpeedKmh(integrante.velocidad_promedio_kmh)}
                </Text>
              )}
              <Text style={[styles.integranteStat, { color: theme.textDim }]}>
                {formatDurationHm(integrante.tiempo_movimiento_seg)} en mov.
              </Text>
            </>
          ) : null}
        </View>
      </View>
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
  grupoCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  separador: {
    height: 1,
    marginHorizontal: 12,
  },
  integranteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  integranteInfo: {
    flex: 1,
    gap: 3,
  },
  integranteNombre: {
    fontSize: 14,
    fontWeight: '600',
  },
  integranteStats: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  integranteStat: {
    fontSize: 12,
  },
})
