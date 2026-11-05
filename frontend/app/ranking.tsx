import { Feather } from '@expo/vector-icons'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import { AvatarFallback } from '@/components/AvatarFallback'
import { Chip, ChipRow, TopBar, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatDurationHm, formatKmCompact } from '@/lib/format'
import {
  obtenerTablaPosiciones,
  type OrdenRankingApi,
  type PeriodoRankingApi,
  type TablaPosicionesApi,
  type TipoActividadRankingApi,
} from '@/lib/tablaPosicionesApi'

const ACTIVIDADES: { id: TipoActividadRankingApi; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'bici', label: 'Bici', icon: 'git-commit' },
  { id: 'running', label: 'Running', icon: 'zap' },
  { id: 'trekking', label: 'Trekking', icon: 'map' },
  { id: 'otro', label: 'Otro', icon: 'more-horizontal' },
]

const PERIODOS: { id: PeriodoRankingApi; label: string }[] = [
  { id: 'semanal', label: 'Esta semana' },
  { id: 'mensual', label: 'Este mes' },
  { id: 'anual', label: 'Este año' },
]

const MEDALLAS = ['🥇', '🥈', '🥉']

export default function TablaPosicionesScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { backendUserId } = useAuth()

  const [tipoActividad, setTipoActividad] = useState<TipoActividadRankingApi>('bici')
  const [periodo, setPeriodo] = useState<PeriodoRankingApi>('semanal')
  const [orden, setOrden] = useState<OrdenRankingApi>('distancia')
  const [tabla, setTabla] = useState<TablaPosicionesApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (esRefresh = false) => {
      try {
        resolveBackendUserId(backendUserId)
      } catch {
        setError('Iniciá sesión para ver la tabla de posiciones.')
        setCargando(false)
        return
      }
      if (esRefresh) setRefreshing(true)
      else setCargando(true)
      setError(null)
      try {
        setTabla(await obtenerTablaPosiciones(tipoActividad, periodo, orden))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la tabla de posiciones.')
      } finally {
        setCargando(false)
        setRefreshing(false)
      }
    },
    [backendUserId, tipoActividad, periodo, orden]
  )

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const formatValor = (fila: { distancia_m: number; tiempo_movimiento_seg: number }) =>
    orden === 'distancia' ? formatKmCompact(fila.distancia_m) : formatDurationHm(fila.tiempo_movimiento_seg)

  const miPosicionEnTop =
    !!tabla?.mi_posicion && tabla.top.some((f) => f.usuario_id === tabla.mi_posicion!.usuario_id)

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Tabla de posiciones" onBack={() => router.back()} bordered={false} />

      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void cargar(true)} tintColor={theme.accent} />
        }
      >
        <ChipRow>
          {ACTIVIDADES.map((a) => (
            <Chip key={a.id} active={tipoActividad === a.id} icon={a.icon} onPress={() => setTipoActividad(a.id)}>
              {a.label}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow>
          {PERIODOS.map((p) => (
            <Chip key={p.id} active={periodo === p.id} onPress={() => setPeriodo(p.id)}>
              {p.label}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow>
          <Chip active={orden === 'distancia'} icon="map" onPress={() => setOrden('distancia')}>
            Kilómetros
          </Chip>
          <Chip active={orden === 'tiempo'} icon="clock" onPress={() => setOrden('tiempo')}>
            Tiempo en movimiento
          </Chip>
        </ChipRow>

        {cargando ? (
          <ActivityIndicator color={theme.accent} size="large" style={styles.spinner} />
        ) : error ? (
          <Text style={[styles.mensaje, { color: theme.danger }]}>{error}</Text>
        ) : !tabla || tabla.top.length === 0 ? (
          <Text style={[styles.mensaje, { color: theme.textMute }]}>
            Todavía nadie completó un viaje de esta actividad en este período.
          </Text>
        ) : (
          <>
            <View style={styles.podio}>
              {tabla.top.map((fila) => {
                const esYo = fila.usuario_id === backendUserId
                return (
                  <View
                    key={fila.usuario_id}
                    style={[
                      styles.filaPodio,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      esYo && { borderColor: theme.accent },
                    ]}
                  >
                    <Text style={styles.medalla}>{MEDALLAS[fila.puesto - 1]}</Text>
                    <AvatarFallback nombre={fila.nombre} size={32} />
                    <Text style={[styles.nombreFila, { color: theme.text }]} numberOfLines={1}>
                      {fila.nombre}
                      {esYo ? ' (Vos)' : ''}
                    </Text>
                    <Text style={[styles.valorFila, { color: theme.accent }]}>{formatValor(fila)}</Text>
                  </View>
                )
              })}
            </View>

            {tabla.mi_posicion && !miPosicionEnTop ? (
              <View
                style={[
                  styles.filaMiPosicion,
                  { backgroundColor: theme.accentWeak, borderColor: theme.accentLine },
                ]}
              >
                <Text style={[styles.puestoMiPosicion, { color: theme.accent }]}>
                  #{tabla.mi_posicion.puesto}
                </Text>
                <Text style={[styles.nombreFila, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                  Vos
                </Text>
                <Text style={[styles.valorFila, { color: theme.accent }]}>
                  {formatValor(tabla.mi_posicion)}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.totalTxt, { color: theme.textMute }]}>
              {tabla.total_participantes} persona{tabla.total_participantes === 1 ? '' : 's'} con actividad
              en este período
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 20, paddingBottom: 40, gap: 14 },
  spinner: { marginTop: 48 },
  mensaje: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 32 },
  podio: { gap: 10 },
  filaPodio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  medalla: { fontSize: 22, width: 28, textAlign: 'center' },
  nombreFila: { flex: 1, fontSize: 15, fontWeight: '700' },
  valorFila: { fontSize: 15, fontWeight: '800' },
  filaMiPosicion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  puestoMiPosicion: { fontSize: 15, fontWeight: '800', width: 36 },
  totalTxt: { fontSize: 12.5, textAlign: 'center' },
})
