import { Pressable, StyleSheet, Text, View } from 'react-native'

/** Acceso al historial de alertas desde el mapa, con contador.
 *  Al líder le suma el botón de crear, para no obligarlo a entrar al historial. */
type Props = {
  cantidad: number
  topOffset: number
  onPress: () => void
  /** Solo se pasa cuando quien mira puede crear alertas (líder, viaje en curso). */
  onCrear?: () => void
}

export function AlertasButton({ cantidad, topOffset, onPress, onCrear }: Props) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.boton, { top: topOffset }, pressed && styles.presionado]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          cantidad > 0 ? `Ver alertas del viaje, ${cantidad} en total` : 'Ver alertas del viaje'
        }
      >
        <Text style={styles.icono}>🔔</Text>
        {cantidad > 0 ? (
          <View style={styles.contador}>
            <Text style={styles.contadorTxt}>{cantidad > 99 ? '99+' : cantidad}</Text>
          </View>
        ) : null}
      </Pressable>

      {onCrear ? (
        <Pressable
          style={({ pressed }) => [
            styles.boton,
            styles.crear,
            { top: topOffset + 54 },
            pressed && styles.presionado,
          ]}
          onPress={onCrear}
          accessibilityRole="button"
          accessibilityLabel="Crear una alerta para el grupo"
        >
          <Text style={styles.crearTxt}>+</Text>
        </Pressable>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  boton: {
    position: 'absolute',
    left: 12,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  icono: {
    fontSize: 20,
  },
  contador: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contadorTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  crear: {
    backgroundColor: '#4338ca',
  },
  crearTxt: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 30,
  },
  presionado: {
    opacity: 0.7,
  },
})
