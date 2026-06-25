import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

import { colorMarcador, type RouteWaypointType } from './routeTypes'

type Props = {
  type: RouteWaypointType
  isLast?: boolean
}

export function RouteTimelineConnector({ type, isLast = false }: Props) {
  const theme = useTheme()

  return (
    <View style={styles.col}>
      <View style={[styles.dot, { backgroundColor: colorMarcador(type, theme) }]} />
      {!isLast ? <View style={[styles.line, { backgroundColor: theme.borderStrong }]} /> : null}
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
    marginVertical: 4,
    minHeight: 24,
  },
})
