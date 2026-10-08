import { StyleSheet, Text, View } from 'react-native'

/** RN-073: marcador del fantasma en el mapa en vivo (violeta, semitransparente). */
const GHOST_MARKER_BOX = 34

export const GHOST_TRAIL_COLOR = '#7c3aed'

export function GhostMarker({ pausado }: { pausado: boolean }) {
  return (
    <View style={[styles.box, { opacity: pausado ? 0.45 : 0.85 }]}>
      <View style={styles.circulo}>
        <Text style={styles.emoji}>👻</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: GHOST_MARKER_BOX, height: GHOST_MARKER_BOX, alignItems: 'center', justifyContent: 'center' },
  circulo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GHOST_TRAIL_COLOR,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 11, lineHeight: 14 },
})
