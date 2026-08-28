import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

type Props = {
  elapsedLabel: string
  distanceLabel: string
  onLayout?: (e: LayoutChangeEvent) => void
}

export function TripMetricsPanel({ elapsedLabel, distanceLabel, onLayout }: Props) {
  const theme = useTheme()

  return (
    <View
      onLayout={onLayout}
      style={[styles.panel, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
    >
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
  )
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
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
