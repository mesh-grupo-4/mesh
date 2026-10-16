import { StyleSheet, Text, View } from 'react-native'

const MARKER_SIZE = 36

/** Marcador del punto donde un integrante registró su parada voluntaria. */
export function ParadaMarker() {
  return (
    <View style={styles.circulo}>
      <Text style={styles.txt}>II</Text>
    </View>
  )
}

export function paradaMarkerPopup(nombre: string, motivo: string | null): { title: string; description: string } {
  return { title: nombre, description: motivo ? `Para ${motivo}` : 'Parada voluntaria' }
}

const styles = StyleSheet.create({
  circulo: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: '#f59e0b',
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { color: '#fff', fontSize: 14, fontWeight: '900' },
})
