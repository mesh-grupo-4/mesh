import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { RANGO_PARAMETROS, textoSeparacion } from '@/lib/activityDefaults'
import type { ParametrosViajeInput, ViajeDetalleApi } from '@/lib/viajesApi'

type Props = {
  viaje: Pick<
    ViajeDetalleApi,
    'velocidad_esperada' | 'distancia_max_separacion' | 'tolerancia_atraso_min' | 'tolerancia_atraso_min_efectivo'
  >
  /** RN-030: el backend valida; acá solo se habilita la UI para el líder. */
  editable: boolean
  guardando: boolean
  onGuardar: (input: ParametrosViajeInput) => void
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/**
 * SCRUM-26 / RN-025: velocidad esperada, separación máxima y tolerancia de atraso
 * del grupo. Nacen con los defaults de la actividad; el líder los ajusta acá.
 */
export function ParametrosGrupoCard({ viaje, editable, guardando, onGuardar }: Props) {
  const theme = useTheme()
  const [abierto, setAbierto] = useState(false)

  const filas: {
    key: keyof ParametrosViajeInput
    label: string
    valor: number
    texto: string
    rango: { min: number; max: number; paso: number }
    personalizado?: boolean
  }[] = [
    {
      key: 'velocidadEsperada',
      label: 'Velocidad esperada',
      valor: viaje.velocidad_esperada,
      texto: `${viaje.velocidad_esperada} km/h`,
      rango: RANGO_PARAMETROS.velocidadEsperada,
    },
    {
      key: 'distanciaMaxSeparacion',
      label: 'Separación máxima',
      valor: viaje.distancia_max_separacion,
      texto: textoSeparacion(viaje.distancia_max_separacion),
      rango: RANGO_PARAMETROS.distanciaMaxSeparacion,
    },
    {
      key: 'toleranciaAtrasoMin',
      label: 'Tolerancia de atraso',
      valor: viaje.tolerancia_atraso_min_efectivo,
      texto: `${viaje.tolerancia_atraso_min_efectivo} min`,
      rango: RANGO_PARAMETROS.toleranciaAtrasoMin,
      personalizado: viaje.tolerancia_atraso_min != null,
    },
  ]

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Parámetros del grupo"
        accessibilityState={{ expanded: abierto }}
      >
        <Feather name="sliders" size={16} color={theme.accent} />
        <Text style={[styles.title, { color: theme.text }]}>Parámetros del grupo</Text>
        <Feather name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textDim} />
      </Pressable>

      {abierto ? (
        <>
          <Text style={[styles.hint, { color: theme.textDim }]}>
            El motor alerta cuando alguien se aleja más que la separación máxima o queda atrás
            más que la tolerancia. Vienen de la actividad; {editable ? 'podés ajustarlos.' : 'los ajusta el líder.'}
          </Text>

          {filas.map((f) => (
            <View key={f.key} style={[styles.row, { borderColor: theme.border }]}>
              <View style={styles.rowLabelCol}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{f.label}</Text>
                {f.personalizado ? (
                  <Pressable
                    onPress={() => onGuardar({ toleranciaAtrasoMin: null })}
                    disabled={guardando || !editable}
                    hitSlop={6}
                  >
                    <Text style={[styles.reset, { color: theme.accent }]}>Volver al de la actividad</Text>
                  </Pressable>
                ) : null}
              </View>
              {editable ? (
                <View style={styles.controls}>
                  <Pressable
                    onPress={() =>
                      onGuardar({ [f.key]: clamp(f.valor - f.rango.paso, f.rango.min, f.rango.max) })
                    }
                    disabled={guardando || f.valor <= f.rango.min}
                    style={[styles.stepBtn, { borderColor: theme.border }]}
                    accessibilityLabel={`Bajar ${f.label}`}
                  >
                    <Feather name="minus" size={16} color={theme.text} />
                  </Pressable>
                  <Text style={[styles.value, { color: theme.text }]}>{f.texto}</Text>
                  <Pressable
                    onPress={() =>
                      onGuardar({ [f.key]: clamp(f.valor + f.rango.paso, f.rango.min, f.rango.max) })
                    }
                    disabled={guardando || f.valor >= f.rango.max}
                    style={[styles.stepBtn, { borderColor: theme.border }]}
                    accessibilityLabel={`Subir ${f.label}`}
                  >
                    <Feather name="plus" size={16} color={theme.text} />
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.value, { color: theme.text }]}>{f.texto}</Text>
              )}
            </View>
          ))}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    paddingVertical: 10,
    marginTop: 10,
  },
  rowLabelCol: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  reset: { fontSize: 12, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 64, textAlign: 'center', fontSize: 15, fontWeight: '700' },
})
