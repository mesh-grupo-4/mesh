import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Pressable } from '@/components/Pressable'
import { ActivityTile, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import { mesesRecientes, totalesPorActividad } from '@/lib/actividadPersonal'
import { etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { formatHorasTotal, formatKmTotal } from '@/lib/format'
import { formatearEnArg } from '@/lib/tiempoArg'
import {
  listarViajesFinalizados,
  obtenerEstadisticasUsuario,
  type EstadisticasUsuarioApi,
  type ViajeFinalizadoApi,
} from '@/lib/viajesApi'

const ALTO_BARRAS = 120
const MESES = 6

type Datos = { estadisticas: EstadisticasUsuarioApi; viajes: ViajeFinalizadoApi[] }

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/** Historial propio: totales, km por mes y desglose por actividad. Sin velocidades (RN-070). */
export default function EstadisticasScreen() {
  const { backendUserId } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  // Mes elegido en el gráfico; `null` = el actual.
  const [mesElegido, setMesElegido] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(false)
    try {
      const userId = resolveBackendUserId(backendUserId)
      const [estadisticas, viajes] = await Promise.all([
        obtenerEstadisticasUsuario(userId),
        listarViajesFinalizados(userId),
      ])
      setDatos({ estadisticas, viajes })
    } catch {
      // Un fallo de red no se muestra como "0 km": queda el último dato (o nada) y reintento.
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [backendUserId])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const meses = useMemo(
    () => (datos ? mesesRecientes(datos.viajes, new Date(), MESES) : []),
    [datos]
  )
  const actividades = useMemo(() => (datos ? totalesPorActividad(datos.viajes) : []), [datos])

  const estadisticas = datos?.estadisticas
  const sinViajes = estadisticas != null && estadisticas.viajes_finalizados === 0
  const maxMes = Math.max(...meses.map((m) => m.metros), 1)
  const maxActividad = Math.max(...actividades.map((a) => a.metros), 1)
  const indiceMes = mesElegido ?? meses.length - 1
  const mes = meses[indiceMes]

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Estadísticas" bordered={false} />

      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 24 }]}>
        {error ? (
          <View style={styles.aviso}>
            <Text style={[styles.avisoTexto, { color: theme.textDim }]}>
              No pudimos cargar tus estadísticas. Revisá tu conexión.
            </Text>
            <Btn variant="primary" onPress={() => void cargar()}>
              Reintentar
            </Btn>
          </View>
        ) : null}

        {!estadisticas ? (
          cargando ? (
            <Text style={[styles.avisoTexto, { color: theme.textMute }]}>Cargando...</Text>
          ) : null
        ) : sinViajes ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.vacioTitulo, { color: theme.text }]}>
              Todavía no terminaste ningún viaje
            </Text>
            <Text style={[styles.vacioTexto, { color: theme.textDim }]}>
              Cuando completes el primero vas a ver acá tus kilómetros, tu tiempo en movimiento y
              cómo se reparten entre tus actividades.
            </Text>
          </View>
        ) : (
          <>
            {/* Total */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.totalValor, { color: theme.text }]}>
                {formatKmTotal(estadisticas.distancia_total_m)}
              </Text>
              <Text style={[styles.totalDetalle, { color: theme.textDim }]}>
                recorridos en{' '}
                {plural(estadisticas.viajes_finalizados, 'viaje terminado', 'viajes terminados')}
              </Text>

              <View style={[styles.hechos, { borderTopColor: theme.border }]}>
                <View style={styles.hecho}>
                  <Text style={[styles.hechoValor, { color: theme.text }]}>
                    {formatHorasTotal(estadisticas.tiempo_total_seg)}
                  </Text>
                  <Text style={[styles.hechoEtiqueta, { color: theme.textDim }]}>en movimiento</Text>
                </View>
                {estadisticas.actividad_favorita ? (
                  <View style={styles.hecho}>
                    <Text style={[styles.hechoValor, { color: theme.text }]} numberOfLines={1}>
                      {etiquetaActividad(estadisticas.actividad_favorita)}
                    </Text>
                    <Text style={[styles.hechoEtiqueta, { color: theme.textDim }]}>
                      tu actividad más frecuente
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Km por mes */}
            <View style={styles.seccion}>
              <Text style={[styles.eyebrow, { color: theme.textDim }]}>
                KILÓMETROS POR MES · ÚLTIMOS {MESES} MESES
              </Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {mes ? (
                  <View>
                    <Text style={[styles.mesValor, { color: theme.text }]}>
                      {formatKmTotal(mes.metros)}
                    </Text>
                    <Text style={[styles.mesDetalle, { color: theme.textDim }]}>
                      {formatearEnArg(mes.inicio, { month: 'long', year: 'numeric' })} ·{' '}
                      {plural(mes.viajes, 'viaje', 'viajes')}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.barras}>
                  {meses.map((m, i) => {
                    const elegido = i === indiceMes
                    const nombre = formatearEnArg(m.inicio, { month: 'short' }).replace('.', '')
                    return (
                      <Pressable
                        key={m.inicio.toISOString()}
                        onPress={() => setMesElegido(i)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: elegido }}
                        accessibilityLabel={`${formatearEnArg(m.inicio, { month: 'long' })}: ${formatKmTotal(
                          m.metros
                        )}, ${plural(m.viajes, 'viaje', 'viajes')}`}
                        style={styles.columna}
                      >
                        <View style={styles.pista}>
                          <View
                            style={[
                              styles.barra,
                              m.metros > 0
                                ? {
                                    height: Math.max((m.metros / maxMes) * ALTO_BARRAS, 4),
                                    backgroundColor: elegido ? theme.accent : theme.accentLine,
                                  }
                                : { height: 2, backgroundColor: theme.borderStrong },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.mesNombre,
                            { color: elegido ? theme.text : theme.textMute },
                            elegido && styles.mesNombreElegido,
                          ]}
                        >
                          {nombre}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                <Text style={[styles.ayudaGrafico, { color: theme.textMute }]}>
                  Tocá un mes para ver su detalle.
                </Text>
              </View>
            </View>

            {/* Por actividad */}
            {actividades.length > 0 ? (
              <View style={styles.seccion}>
                <Text style={[styles.eyebrow, { color: theme.textDim }]}>POR ACTIVIDAD</Text>
                <View
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  {actividades.map((a) => (
                    <View key={a.tipo} style={styles.actividad}>
                      <ActivityTile activity={a.tipo} size={38} />
                      <View style={styles.actividadCuerpo}>
                        <View style={styles.actividadFila}>
                          <Text style={[styles.actividadNombre, { color: theme.text }]}>
                            {etiquetaActividad(a.tipo)}
                          </Text>
                          <Text style={[styles.actividadKm, { color: theme.text }]}>
                            {formatKmTotal(a.metros)}
                          </Text>
                        </View>
                        <View style={[styles.proporcionPista, { backgroundColor: theme.surface2 }]}>
                          <View
                            style={[
                              styles.proporcion,
                              {
                                backgroundColor: theme.accent,
                                width: `${Math.max((a.metros / maxActividad) * 100, 2)}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.actividadDetalle, { color: theme.textDim }]}>
                          {plural(a.viajes, 'viaje', 'viajes')} · {formatHorasTotal(a.segundos)} en
                          movimiento
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contenido: { padding: 20, gap: 22 },
  seccion: { gap: 10 },
  eyebrow: { fontSize: 11, fontFamily: 'SpaceMono', fontWeight: '700', letterSpacing: 1.2 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, gap: 14 },

  aviso: { alignItems: 'center', gap: 12 },
  avisoTexto: { fontSize: 14, textAlign: 'center' },
  vacioTitulo: { fontSize: 17, fontWeight: '800' },
  vacioTexto: { fontSize: 14, lineHeight: 20 },

  totalValor: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  totalDetalle: { fontSize: 15, marginTop: -10 },
  hechos: { flexDirection: 'row', gap: 16, paddingTop: 14, borderTopWidth: 1 },
  hecho: { flex: 1, gap: 2 },
  hechoValor: { fontSize: 18, fontWeight: '800' },
  hechoEtiqueta: { fontSize: 13 },

  mesValor: { fontSize: 24, fontWeight: '800' },
  mesDetalle: { fontSize: 13.5, marginTop: 2 },
  barras: { flexDirection: 'row', gap: 8 },
  columna: { flex: 1, alignItems: 'center', gap: 6 },
  pista: { height: ALTO_BARRAS, alignSelf: 'stretch', justifyContent: 'flex-end', alignItems: 'center' },
  barra: { width: '70%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  mesNombre: { fontSize: 12 },
  mesNombreElegido: { fontWeight: '800' },
  ayudaGrafico: { fontSize: 12, textAlign: 'center' },

  actividad: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actividadCuerpo: { flex: 1, gap: 5 },
  actividadFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  actividadNombre: { fontSize: 15.5, fontWeight: '700' },
  actividadKm: { fontSize: 15.5, fontWeight: '800' },
  proporcionPista: { height: 5, borderRadius: 3, overflow: 'hidden' },
  proporcion: { height: 5, borderRadius: 3 },
  actividadDetalle: { fontSize: 12.5 },
})
