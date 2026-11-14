import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet } from 'react-native'

/**
 * Botón chico abajo a la derecha de un mapa en miniatura: vuelve a encuadrar el
 * recorrido completo. Va como último hijo de un contenedor con el mapa, para
 * quedar por encima de él (y de cualquier capa que bloquee los gestos).
 */
export function BotonEncuadrar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.presionado]}
      accessibilityRole="button"
      accessibilityLabel="Encuadrar recorrido"
    >
      <Feather name="maximize" size={18} color="#111827" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  presionado: { opacity: 0.7 },
})
