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
import Svg, {
  Defs,
  LinearGradient,
  Line as SvgLine,
  Path as SvgPath,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { ActivityTile, Badge, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { StatCard, StatCardRow } from '@/components/StatCard'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import {
  formatDurationHm,
  formatKm,
  formatPace,
  formatSpeedKmh,
} from '@/lib/format'
import {
  obtenerMetricasIndividuales,
  type MetricasIndividualesApi,
  type PerfilVelocidadPuntoApi,
} from '@/lib/viajesApi'

export default function MetricasScreen() {
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

  const [data, setData] = useState<MetricasIndividualesApi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await obtenerMetricasIndividuales(viajeId, userId)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las métricas')
    } finally {
      setLoading(false)
    }
  }, [viajeId, userId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const volver = () => router.back()

  if (!viajeId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title="Mis métricas" onBack={volver} bordered={false} />
        <View style={styles.center}>
          <Text style={{ color: theme.textDim }}>Viaje no especificado.</Text>
        </View>
      </View>
    )
  }

  const viaje = data?.viaje
  const m = data?.metricas
  const perfil = data?.perfil_velocidad ?? []
  const esMoto = viaje?.tipo_actividad === 'moto'
  const esPace = viaje?.tipo_actividad === 'running' || viaje?.tipo_actividad === 'trekking'

  const nombreViaje =
    viaje?.nombre?.trim() ||
    (viaje?.es_grupal ? 'Salida grupal' : 'Salida individual')

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Mis métricas"
        sub={loading ? 'Cargando...' : nombreViaje}
        onBack={volver}
        bordered={false}
      />

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
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {viaje ? (
            <View style={styles.hero}>
              <ActivityTile activity={viaje.tipo_actividad} size={46} />
              <View style={styles.heroText}>
                <Text style={[styles.tripName, { color: theme.text }]} numberOfLines={2}>
                  {nombreViaje}
                </Text>
                <View style={styles.badgeRow}>
                  <Badge tone="mute">Finalizado</Badge>
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Métricas principales ── */}
          {m ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>Recorrido</Text>

              <StatCardRow>
                <StatCard
                  icon="activity"
                  value={formatKm(m.distancia_m)}
                  label="Distancia"
                />
                <StatCard
                  icon="clock"
                  value={formatDurationHm(m.duracion_segundos)}
                  label="Duración"
                />
                <StatCard
                  icon="play-circle"
                  value={formatDurationHm(m.tiempo_movimiento_seg)}
                  label="En movimiento"
                />
              </StatCardRow>

              <StatCardRow>
                <StatCard
                  icon="pause-circle"
                  value={formatDurationHm(m.tiempo_detenido_seg)}
                  label="Detenido"
                />
                {!esMoto ? (
                  <StatCard
                    icon="trending-up"
                    value={formatSpeedKmh(m.velocidad_promedio_kmh)}
                    label="Vel. promedio"
                  />
                ) : null}
                {!esMoto ? (
                  <StatCard
                    icon="zap"
                    value={formatSpeedKmh(m.velocidad_maxima_kmh)}
                    label="Vel. máxima"
                  />
                ) : null}
              </StatCardRow>

              {esPace ? (
                <StatCardRow>
                  <StatCard
                    icon="watch"
                    value={formatPace(m.tiempo_movimiento_seg, m.distancia_m)}
                    label="Ritmo promedio"
                  />
                  {m.cantidad_paradas > 0 ? (
                    <StatCard
                      icon="map-pin"
                      value={String(m.cantidad_paradas)}
                      label="Paradas"
                    />
                  ) : null}
                </StatCardRow>
              ) : (
                m.cantidad_paradas > 0 ? (
                  <StatCardRow>
                    <StatCard
                      icon="map-pin"
                      value={String(m.cantidad_paradas)}
                      label="Paradas"
                    />
                  </StatCardRow>
                ) : null
              )}
            </>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.sinDatos, { color: theme.textDim }]}>
                Sin métricas disponibles para este viaje.
              </Text>
            </View>
          )}

          {/* ── Gráfico de velocidad ── */}
          {perfil.length >= 2 ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>
                {esPace ? 'Velocidad por minuto' : 'Velocidad por minuto'}
              </Text>
              <View
                style={[
                  styles.chartCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <VelocidadChart data={perfil} accentColor={theme.accent} borderColor={theme.border} textMuteColor={theme.textDim} />
                <Text style={[styles.chartCaption, { color: theme.textDim }]}>
                  km/h · promedio por minuto
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente: Gráfico de línea de velocidad con react-native-svg
// ──────────────────────────────────────────────────────────────────────────────

type VelocidadChartProps = {
  data: PerfilVelocidadPuntoApi[]
  accentColor: string
  borderColor: string
  textMuteColor: string
}

function VelocidadChart({ data, accentColor, borderColor, textMuteColor }: VelocidadChartProps) {
  const [width, setWidth] = useState(0)

  if (data.length < 2) return null

  const height = 148
  const padLeft = 34
  const padRight = 8
  const padTop = 10
  const padBottom = 22
  const chartW = Math.max(0, width - padLeft - padRight)
  const chartH = Math.max(0, height - padTop - padBottom)

  const maxT = data[data.length - 1]!.t_seg
  const rawMax = Math.max(...data.map((d) => d.velocidad_kmh))
  const maxV = rawMax > 0 ? Math.ceil((rawMax * 1.15) / 5) * 5 : 10

  const xScale = (t: number) => padLeft + (t / (maxT || 1)) * chartW
  const yScale = (v: number) => padTop + chartH - (v / maxV) * chartH

  // Línea principal
  const pathD = data
    .map((d, i) => {
      const x = xScale(d.t_seg).toFixed(1)
      const y = yScale(d.velocidad_kmh).toFixed(1)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Área de relleno (fill bajo la línea)
  const fillD =
    pathD +
    ` L ${xScale(maxT).toFixed(1)} ${(padTop + chartH).toFixed(1)}` +
    ` L ${xScale(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`

  // Etiquetas Y (0, mitad, máximo)
  const yLabels = [
    { v: 0, label: '0' },
    { v: maxV / 2, label: String(Math.round(maxV / 2)) },
    { v: maxV, label: String(maxV) },
  ]

  // Etiquetas X (inicio, mitad, fin)
  const totalMins = maxT / 60
  const xLabelCandidates: number[] = [0]
  if (totalMins >= 4) xLabelCandidates.push(Math.round(totalMins / 2))
  xLabelCandidates.push(Math.round(totalMins))

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity="0.25" />
              <Stop offset="1" stopColor={accentColor} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Líneas guía Y */}
          {yLabels.map(({ v, label }) => {
            const y = yScale(v)
            return (
              <SvgLine
                key={v}
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke={borderColor}
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : '3,3'}
              />
            )
          })}

          {/* Etiquetas Y */}
          {yLabels.map(({ v, label }) => (
            <SvgText
              key={`yl-${v}`}
              x={padLeft - 4}
              y={yScale(v) + 4}
              fill={textMuteColor}
              fontSize={9}
              textAnchor="end"
            >
              {label}
            </SvgText>
          ))}

          {/* Área rellena */}
          <SvgPath d={fillD} fill="url(#grad)" />

          {/* Línea de velocidad */}
          <SvgPath
            d={pathD}
            stroke={accentColor}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Etiquetas X */}
          {xLabelCandidates.map((mins) => (
            <SvgText
              key={`xl-${mins}`}
              x={xScale(mins * 60)}
              y={padTop + chartH + 16}
              fill={textMuteColor}
              fontSize={9}
              textAnchor="middle"
            >
              {mins}m
            </SvgText>
          ))}
        </Svg>
      ) : null}
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
    paddingHorizontal: 24,
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
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sinDatos: {
    fontSize: 14,
    textAlign: 'center',
  },
  chartCard: {
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  chartCaption: {
    fontSize: 11,
    textAlign: 'center',
  },
})
