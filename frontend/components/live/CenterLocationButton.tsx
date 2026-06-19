import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet } from 'react-native'

type Props = {
  onPress: () => void
  bottomOffset?: number
  /** Posición horizontal: derecha por defecto; izquierda evita solaparse con el selector de mapa. */
  align?: 'left' | 'right'
}

export function CenterLocationButton({ onPress, bottomOffset = 120, align = 'left' }: Props) {
  return (
    <Pressable
      style={[
        styles.btn,
        { bottom: bottomOffset },
        align === 'left' ? styles.left : styles.right,
      ]}
      onPress={onPress}
      accessibilityLabel="Centrar en mi ubicación"
    >
      <Feather name="crosshair" size={22} color="#111827" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  left: {
    left: 16,
  },
  right: {
    right: 16,
  },
})
