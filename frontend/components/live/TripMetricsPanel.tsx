import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

/** RN-065: fila extra del modo entrenamiento. Ya formateados; '--' sin dato. */
export type EntrenamientoEnVivo = {
  velocidadActual: string
  velocidadPromedio: string
  ritmo: string
}

type Props = {
  elapsedLabel: string
  distanceLabel: string
  entrenamiento?: EntrenamientoEnVivo | null
  onLayout?: (e: LayoutChangeEvent) => void
}

export function TripMetricsPanel({ elapsedLabel, distanceLabel, entrenamiento, onLayout }: Props) {
  const theme = useTheme()

  return (
    <View
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
    >
      <View style={styles.panel}>
        <View style={styles.metric}>
          <Text style={[styles.label, { color: theme.textDim }]}>Tiempo transcurrido</Text>
          <Text style={[styles.value, { color: theme.text }]}>{elapsedLabel}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.metric}>
          <Text style={[styles.label, { color: theme.textDim }]}>Distancia recorrida</Text>
          <Text style={[styles.value, { color: theme.text }]}>{distanceLabel}</Text>
        </View>
      </View>

      {entrenamiento ? (
        <View style={[styles.panel, styles.panelEntrenamiento, { borderTopColor: theme.border }]}>
          <View style={styles.metric}>
            <Text style={[styles.label, { color: theme.textDim }]}>Vel. actual</Text>
            <Text style={[styles.valueSm, { color: theme.accent }]}>{entrenamiento.velocidadActual}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.metric}>
            <Text style={[styles.label, { color: theme.textDim }]}>Promedio</Text>
            <Text style={[styles.valueSm, { color: theme.text }]}>{entrenamiento.velocidadPromedio}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.metric}>
            <Text style={[styles.label, { color: theme.textDim }]}>Ritmo</Text>
            <Text style={[styles.valueSm, { color: theme.text }]}>{entrenamiento.ritmo}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    paddingBottom: 8,
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  panelEntrenamiento: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  valueSm: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 40,
  },
})
