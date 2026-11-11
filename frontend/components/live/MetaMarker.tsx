import { StyleSheet, Text, View } from 'react-native'

const DIAMETRO = 40
const ALTO_PUNTA = 9

/** Ancla en la punta inferior: la meta marca el punto exacto del destino. */
export const META_ANCHOR = { x: 0.5, y: 1 }

const COLOR_PENDIENTE = '#111827'
const COLOR_ALCANZADA = '#2f9e63'

/** Meta del viaje: bandera a cuadros sobre el destino. Cambia de color al llegar. */
export function MetaMarker({ alcanzada }: { alcanzada: boolean }) {
  const color = alcanzada ? COLOR_ALCANZADA : COLOR_PENDIENTE
  return (
    <View style={styles.caja}>
      <View style={[styles.circulo, { backgroundColor: color }]}>
        <Text style={styles.bandera}>🏁</Text>
      </View>
      <View style={[styles.punta, { borderTopColor: color }]} />
    </View>
  )
}

export function metaMarkerKey(alcanzada: boolean): string {
  return alcanzada ? 'alcanzada' : 'pendiente'
}

const styles = StyleSheet.create({
  caja: { width: DIAMETRO, height: DIAMETRO + ALTO_PUNTA - 2, alignItems: 'center' },
  circulo: {
    width: DIAMETRO,
    height: DIAMETRO,
    borderRadius: DIAMETRO / 2,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandera: { fontSize: 19, lineHeight: 24 },
  punta: {
    marginTop: -3,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: ALTO_PUNTA,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})
