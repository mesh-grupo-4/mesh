import { Feather } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { iconoClima, obtenerClimaViaje, type ClimaViajeApi } from '@/lib/climaApi'
import { formatearEnArg } from '@/lib/tiempoArg'

type Props = {
  viajeId: string
  /** Solo se consulta con viaje planificado o en curso. */
  habilitado: boolean
  /** Cambia cuando se reconfigura la ruta o la fecha, para volver a pedir el pronóstico. */
  claveRefresco?: string
}

const MOTIVO: Record<NonNullable<ClimaViajeApi['motivo']>, string> = {
  SIN_RUTA: 'Configurá la ruta para ver el pronóstico sobre el recorrido.',
  FUERA_DE_HORIZONTE: 'El pronóstico aparece desde 15 días antes de la salida.',
  VIAJE_FINALIZADO: 'El viaje ya terminó.',
}

/**
 * SCRUM-27 / RN-108: pronóstico sobre la ruta en la pantalla previa al inicio.
 * Alerta lluvia y viento fuerte en algún punto del recorrido.
 */
export function ClimaViajeCard({ viajeId, habilitado, claveRefresco }: Props) {
  const theme = useTheme()
  const [clima, setClima] = useState<ClimaViajeApi | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!viajeId || !habilitado) return
    setCargando(true)
    setError(null)
    try {
      setClima(await obtenerClimaViaje(viajeId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el pronóstico.')
    } finally {
      setCargando(false)
    }
  }, [viajeId, habilitado])

  useEffect(() => {
    void cargar()
    // `claveRefresco` fuerza una nueva consulta cuando cambian ruta o fecha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, claveRefresco])

  if (!habilitado) return null

  const hayAlertas = (clima?.alertas.length ?? 0) > 0
  const borde = hayAlertas ? theme.danger : theme.border

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: borde }]}>
      <View style={styles.header}>
        <Feather
          name={hayAlertas ? 'alert-triangle' : 'sun'}
          size={16}
          color={hayAlertas ? theme.danger : theme.accent}
        />
        <Text style={[styles.title, { color: theme.text }]}>Clima en la ruta</Text>
        <Pressable onPress={() => void cargar()} hitSlop={8} accessibilityLabel="Actualizar pronóstico">
          {cargando ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Feather name="refresh-cw" size={15} color={theme.textDim} />
          )}
        </Pressable>
      </View>

      {error ? (
        <Text style={[styles.hint, { color: theme.textDim }]}>{error}</Text>
      ) : !clima ? (
        cargando ? null : <Text style={[styles.hint, { color: theme.textDim }]}>Sin datos todavía.</Text>
      ) : !clima.disponible ? (
        <Text style={[styles.hint, { color: theme.textDim }]}>
          {clima.motivo ? MOTIVO[clima.motivo] : clima.resumen}
        </Text>
      ) : (
        <>
          {clima.alertas.map((a) => (
            <View
              key={a.tipo}
              style={[styles.alerta, { backgroundColor: theme.dangerWeak }]}
              accessibilityRole="alert"
            >
              <Feather
                name={a.tipo === 'lluvia' ? 'cloud-rain' : 'wind'}
                size={15}
                color={theme.danger}
              />
              <Text style={[styles.alertaTxt, { color: theme.danger }]}>{a.mensaje}</Text>
            </View>
          ))}
          <Text style={[styles.resumen, { color: theme.text }]}>{clima.resumen}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puntos}>
            {clima.puntos.map((p) => {
              const alerta = p.lluvia || p.viento_fuerte
              return (
                <View
                  key={`${p.nombre}-${p.hora}`}
                  style={[
                    styles.punto,
                    {
                      backgroundColor: alerta ? theme.dangerWeak : theme.surface2,
                      borderColor: alerta ? theme.danger : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.puntoNombre, { color: theme.text }]} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                  <Text style={[styles.puntoHora, { color: theme.textMute }]}>
                    {formatearEnArg(p.hora, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Feather
                    name={iconoClima(p.codigo_tiempo)}
                    size={22}
                    color={alerta ? theme.danger : theme.accent}
                    style={styles.puntoIcono}
                  />
                  <Text style={[styles.puntoTemp, { color: theme.text }]}>
                    {p.temperatura_c != null ? `${Math.round(p.temperatura_c)}°` : '--'}
                  </Text>
                  <Text style={[styles.puntoDetalle, { color: theme.textDim }]} numberOfLines={1}>
                    {p.descripcion}
                  </Text>
                  <Text style={[styles.puntoDetalle, { color: p.viento_fuerte ? theme.danger : theme.textDim }]}>
                    {p.viento_kmh != null ? `${Math.round(p.viento_kmh)} km/h` : '--'}
                    {p.prob_precipitacion_pct != null ? ` · ${Math.round(p.prob_precipitacion_pct)}%` : ''}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  alertaTxt: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  resumen: { marginTop: 10, fontSize: 14, lineHeight: 19 },
  puntos: { gap: 8, paddingTop: 10 },
  punto: { width: 112, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  puntoNombre: { fontSize: 13, fontWeight: '700', maxWidth: '100%' },
  puntoHora: { fontSize: 11, marginTop: 2 },
  puntoIcono: { marginVertical: 6 },
  puntoTemp: { fontSize: 18, fontWeight: '800' },
  puntoDetalle: { fontSize: 11, marginTop: 2 },
})
