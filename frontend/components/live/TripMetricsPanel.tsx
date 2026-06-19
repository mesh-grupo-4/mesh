import { StyleSheet, Text, View } from 'react-native'

type Props = {
  elapsedLabel: string
  distanceLabel: string
}

export function TripMetricsPanel({ elapsedLabel, distanceLabel }: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.metric}>
        <Text style={styles.label}>Tiempo transcurrido</Text>
        <Text style={styles.value}>{elapsedLabel}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.metric}>
        <Text style={styles.label}>Distancia recorrida</Text>
        <Text style={styles.value}>{distanceLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
    color: '#6b7280',
    fontWeight: '600',
  },
  value: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
})
