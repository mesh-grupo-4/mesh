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
  formatDeltaKm,
  formatDeltaPace,
  formatDurationHm,
  formatKm,
  formatPace,
  formatPaceMinKm,
  formatSpeedKmh,
} from '@/lib/format'
import { formatearEnArg } from '@/lib/tiempoArg'
import {
  obtenerMetricasIndividuales,
  type MetricasIndividualesApi,
  type PerfilVelocidadPuntoApi,
  type SesionEntrenamientoApi,
  type SplitKmApi,
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
  const splits = data?.splits_km ?? []
  const entrenamiento = data?.entrenamiento ?? null
  const esEntrenamiento = viaje?.modo === 'entrenamiento'
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
                  {esEntrenamiento ? <Badge tone="good">Entrenamiento</Badge> : null}
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

          {/* ── RN-065: entrenamiento — evolución entre sesiones ── */}
          {esEntrenamiento && entrenamiento ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>
                Sesión {entrenamiento.numero_sesion} de {entrenamiento.total_sesiones}
              </Text>
              <StatCardRow>
                <StatCard
                  icon="trending-up"
                  value={formatDeltaKm(entrenamiento.delta_distancia_m)}
                  label="vs. sesión anterior"
                  hint={entrenamiento.es_mejor_distancia ? 'Tu mayor distancia' : undefined}
                />
                {!esMoto ? (
                  <StatCard
                    icon="watch"
                    value={formatDeltaPace(entrenamiento.delta_pace_min_km)}
                    label="Ritmo vs. anterior"
                    hint={entrenamiento.es_mejor_pace ? 'Tu mejor ritmo' : undefined}
                  />
                ) : null}
                {!esMoto ? (
                  <StatCard
                    icon="award"
                    value={formatPaceMinKm(entrenamiento.mejor_pace_min_km)}
                    label="Mejor ritmo"
                  />
                ) : (
                  <StatCard
                    icon="award"
                    value={formatKm(entrenamiento.mejor_distancia_m)}
                    label="Mayor distancia"
                  />
                )}
              </StatCardRow>

              {entrenamiento.evolucion.length >= 2 ? (
                <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <EvolucionSesiones
                    sesiones={entrenamiento.evolucion}
                    actualId={viaje?.id ?? ''}
                    esMoto={esMoto}
                    accentColor={theme.accent}
                    textColor={theme.text}
                    textMuteColor={theme.textDim}
                    barColor={theme.surface2}
                  />
                  <Text style={[styles.chartCaption, { color: theme.textDim }]}>
                    Últimas sesiones de {viaje?.tipo_actividad} · distancia y {esMoto ? 'tiempo' : 'ritmo'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.sinDatos, { color: theme.textDim }]}>
                  Con tu próxima sesión vas a ver la evolución acá.
                </Text>
              )}
            </>
          ) : null}

          {/* ── RN-065: splits por kilómetro ── */}
          {splits.length > 0 ? (
            <>
              <Text style={[styles.seccion, { color: theme.text }]}>Tiempo por kilómetro</Text>
              <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <SplitsList
                  splits={splits}
                  esPace={esPace}
                  accentColor={theme.accent}
                  textColor={theme.text}
                  textMuteColor={theme.textDim}
                  barColor={theme.surface2}
                />
              </View>
            </>
          ) : null}

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
// RN-065: splits por kilómetro (barras relativas al km más lento)

function SplitsList({
  splits,
  esPace,
  accentColor,
  textColor,
  textMuteColor,
  barColor,
}: {
  splits: SplitKmApi[]
  esPace: boolean
  accentColor: string
  textColor: string
  textMuteColor: string
  barColor: string
}) {
  const paces = splits.map((s) => s.pace_min_km ?? 0)
  const maxPace = Math.max(...paces, 0.01)
  return (
    <View style={{ gap: 8 }}>
      {splits.map((sp) => {
        const parcial = sp.metros < 990
        const ancho = sp.pace_min_km != null ? Math.max(0.08, sp.pace_min_km / maxPace) : 0
        const valor = esPace
          ? formatPaceMinKm(sp.pace_min_km)
          : sp.pace_min_km != null
            ? formatSpeedKmh(60 / sp.pace_min_km)
            : '--'
        return (
          <View key={sp.km} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ width: 44, fontSize: 13, fontWeight: '700', color: textColor }}>
              {parcial ? `${(sp.metros / 1000).toFixed(1)}` : `km ${sp.km}`}
            </Text>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: barColor, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(ancho * 100)}%`, height: '100%', backgroundColor: accentColor, opacity: parcial ? 0.55 : 1 }} />
            </View>
            <Text style={{ width: 84, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'], color: parcial ? textMuteColor : textColor }}>
              {valor}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// RN-065: evolución entre sesiones de entrenamiento (barras de distancia + ritmo)

function EvolucionSesiones({
  sesiones,
  actualId,
  esMoto,
  accentColor,
  textColor,
  textMuteColor,
  barColor,
}: {
  sesiones: SesionEntrenamientoApi[]
  actualId: string
  esMoto: boolean
  accentColor: string
  textColor: string
  textMuteColor: string
  barColor: string
}) {
  const maxDist = Math.max(...sesiones.map((s) => s.distancia_m), 1)
  return (
    <View style={{ gap: 10 }}>
      {sesiones.map((s) => {
        const actual = s.viaje_id === actualId
        return (
          <View key={s.viaje_id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, fontWeight: actual ? '800' : '600', color: actual ? accentColor : textMuteColor }}>
                {formatearEnArg(s.fecha_fin_real, { day: '2-digit', month: 'short' })}
                {actual ? ' · esta sesión' : ''}
              </Text>
              <Text style={{ fontSize: 12, fontVariant: ['tabular-nums'], color: textColor }}>
                {formatKm(s.distancia_m)} · {esMoto ? formatDurationHm(s.tiempo_movimiento_seg) : formatPaceMinKm(s.pace_min_km)}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: barColor, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round((s.distancia_m / maxDist) * 100)}%`, height: '100%', backgroundColor: accentColor, opacity: actual ? 1 : 0.45 }} />
            </View>
          </View>
        )
      })}
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
