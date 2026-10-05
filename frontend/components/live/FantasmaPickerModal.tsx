import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ActivityTile, useTheme } from '@/components/MeshUI'
import { formatDurationHm, formatKm } from '@/lib/format'
import { listarCandidatosFantasma, type CandidatoFantasmaApi } from '@/lib/fantasmaApi'
import { formatearEnArg } from '@/lib/tiempoArg'

type Props = {
  visible: boolean
  viajeId: string
  ocupado: boolean
  onElegir: (ref: string) => void
  onCerrar: () => void
}

/** RN-073 (SCRUM-50): elegir un viaje anterior propio, de otro integrante o una ruta compartida. */
export function FantasmaPickerModal({ visible, viajeId, ocupado, onElegir, onCerrar }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [candidatos, setCandidatos] = useState<CandidatoFantasmaApi[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelado = false
    setCandidatos(null)
    setError(null)
    listarCandidatosFantasma(viajeId)
      .then((c) => {
        if (!cancelado) setCandidatos(c)
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudieron cargar los recorridos.')
      })
    return () => {
      cancelado = true
    }
  }, [visible, viajeId])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={[styles.bg, { backgroundColor: theme.scrim }]} onPress={onCerrar}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.titulo, { color: theme.text }]}>Elegir fantasma</Text>
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Un viaje anterior tuyo, la traza de alguien con quien saliste o una ruta compartida.
          </Text>

          {error ? (
            <Text style={[styles.hint, { color: theme.danger }]}>{error}</Text>
          ) : candidatos == null ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 24 }} />
          ) : candidatos.length === 0 ? (
            <Text style={[styles.hint, { color: theme.textDim }]}>
              Todavía no tenés recorridos finalizados ni rutas compartidas para comparar.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }}>
              {candidatos.map((c) => (
                <Pressable
                  key={c.ref}
                  disabled={ocupado}
                  onPress={() => onElegir(c.ref)}
                  style={({ pressed }) => [
                    styles.fila,
                    { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <ActivityTile activity={c.tipo_actividad} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
                      {c.nombre}
                    </Text>
                    <Text style={[styles.meta, { color: theme.textDim }]} numberOfLines={1}>
                      {c.autor}
                      {c.fecha ? ` · ${formatearEnArg(c.fecha, { day: '2-digit', month: 'short' })}` : ''}
                      {c.distancia_m != null ? ` · ${formatKm(c.distancia_m)}` : ''}
                      {c.duracion_seg != null ? ` · ${formatDurationHm(c.duracion_seg)}` : ''}
                      {c.tipo === 'plantilla' ? ' · ritmo estimado' : ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable onPress={onCerrar} style={[styles.cerrar, { borderColor: theme.border }]}>
            <Text style={[styles.cerrarTxt, { color: theme.text }]}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1.2, paddingHorizontal: 20, paddingTop: 18 },
  titulo: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  nombre: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 2 },
  cerrar: { marginTop: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1.2, alignItems: 'center' },
  cerrarTxt: { fontSize: 15, fontWeight: '700' },
})
