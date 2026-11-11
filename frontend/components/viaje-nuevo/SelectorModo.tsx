import { StyleSheet, Text, View } from 'react-native'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'
import type { ModoViajeApi } from '@/lib/viajesApi'

type Props = {
  modo: ModoViajeApi
  onChange: (modo: ModoViajeApi) => void
  /** RN-071 / RN-070: competir exige viaje grupal y nunca vehículo motorizado. */
  puedeCompetir: boolean
  /** RN-065 / RN-070: en moto y auto tampoco hay modo entrenamiento. */
  motorizado?: boolean
}

const OPCIONES: { id: ModoViajeApi; label: string }[] = [
  { id: 'recreativo', label: 'Recreativo' },
  { id: 'entrenamiento', label: 'Entrenamiento' },
  { id: 'competitivo', label: 'Competitivo' },
]

function detalleModo(modo: ModoViajeApi): string {
  if (modo === 'entrenamiento') return 'Ritmo en vivo, splits y evolución de tus sesiones.'
  if (modo === 'competitivo') return 'Clasificación en vivo y recap con puestos.'
  return 'Navegación y alertas, sin comparaciones.'
}

/** RN-065: modo del viaje como control segmentado, con el detalle del elegido debajo. */
export function SelectorModo({ modo, onChange, puedeCompetir, motorizado = false }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.wrap}>
      <View style={[styles.segmentos, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {OPCIONES.map((o) => {
          const activo = modo === o.id
          const bloqueado =
            (o.id === 'competitivo' && !puedeCompetir) || (o.id === 'entrenamiento' && motorizado)
          return (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: activo, disabled: bloqueado }}
              disabled={bloqueado}
              onPress={() => onChange(o.id)}
              style={[
                styles.segmento,
                activo && { backgroundColor: theme.accent },
                bloqueado && { opacity: 0.35 },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.segmentoTexto, { color: activo ? theme.onAccent : theme.text }]}
              >
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={[styles.detalle, { color: theme.textDim }]}>{detalleModo(modo)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  segmentos: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  segmento: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentoTexto: { fontSize: 15, fontWeight: '700' },
  detalle: { fontSize: 14, lineHeight: 20 },
})
