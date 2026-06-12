import { StyleSheet, View } from 'react-native'

import { colorMarcador, type RouteWaypointType } from './routeTypes'

type Props = {
  type: RouteWaypointType
  isLast?: boolean
}

export function RouteTimelineConnector({ type, isLast = false }: Props) {
  return (
    <View style={styles.col}>
      <View style={[styles.dot, { backgroundColor: colorMarcador(type) }]} />
      {!isLast ? <View style={styles.line} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  col: {
    width: 20,
    alignItems: 'center',
    paddingTop: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#d1d5db',
    marginVertical: 4,
    minHeight: 24,
  },
})
