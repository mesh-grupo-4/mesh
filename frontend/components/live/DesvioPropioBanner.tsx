import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'

/**
 * RN-034b: el motor detectó que este participante salió de la ruta (el líder ya fue
 * avisado). Si fue a propósito, lo confirma y no se le insiste hasta que vuelva.
 */
type Props = {
  ocupado: boolean
  /** Sigue en el viaje: se desvía un rato y vuelve. */
  onAProposito: () => void
  /** Se va: sale del viaje y deja de compartir ubicación (pide confirmación). */
  onMeVuelvo: () => void
}

export function DesvioPropioBanner({ ocupado, onAProposito, onMeVuelvo }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.titulo}>Saliste de la ruta</Text>
      <Text style={styles.subtitulo}>
        Le avisamos al líder. Si te desviás un rato y volvés, confirmalo. Si te vas, salí del
        viaje para dejar de compartir tu ubicación.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.boton, pressed && styles.presionado, ocupado && styles.deshabilitado]}
        onPress={onAProposito}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityLabel="Confirmar que me desvío a propósito"
      >
        {ocupado ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTxt}>Me desvío y vuelvo</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.botonSalir,
          pressed && styles.presionado,
          ocupado && styles.deshabilitado,
        ]}
        onPress={onMeVuelvo}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityLabel="Me vuelvo: salir del viaje y dejar de compartir mi ubicación"
      >
        <Text style={styles.botonSalirTxt}>Me vuelvo · Salir del viaje</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
  },
  subtitulo: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    color: '#78350f',
    fontWeight: '600',
  },
  boton: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b45309',
  },
  botonTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  botonSalir: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#b45309',
  },
  botonSalirTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
  },
  presionado: {
    opacity: 0.75,
  },
  deshabilitado: {
    opacity: 0.5,
  },
})
