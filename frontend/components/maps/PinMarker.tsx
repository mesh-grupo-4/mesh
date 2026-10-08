import { StyleSheet, View } from 'react-native'

/** Ancla en la punta inferior del pin (fracción del tamaño del marcador). */
export const PIN_ANCHOR = { x: 0.5, y: 1 }

/** Pin clásico en forma de gota (25x41, ancla en la punta inferior). */
export function PinMarker({ color }: { color: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.gota, { backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: 25, height: 41, alignItems: 'center', justifyContent: 'center' },
  gota: {
    width: 25,
    height: 25,
    borderTopLeftRadius: 12.5,
    borderTopRightRadius: 12.5,
    borderBottomRightRadius: 12.5,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 2,
    borderColor: '#fff',
  },
})
