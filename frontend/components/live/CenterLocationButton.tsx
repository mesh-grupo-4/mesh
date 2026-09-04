import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet } from 'react-native'

import { uiConfigPorActividad } from '@/lib/activityUi'
import type { TipoActividadApi } from '@/lib/viajesApi'

type Props = {
  onPress: () => void
  bottomOffset?: number
  /** Posición horizontal: derecha por defecto; izquierda evita solaparse con el selector de mapa. */
  align?: 'left' | 'right'
  /** true mientras el mapa te sigue automáticamente (modo "seguirme" activo). */
  siguiendo?: boolean
  tipoActividad?: TipoActividadApi
}

export function CenterLocationButton({
  onPress,
  bottomOffset = 120,
  align = 'left',
  siguiendo = false,
  tipoActividad = 'otro',
}: Props) {
  const { escalaBotones } = uiConfigPorActividad(tipoActividad)
  const tam = Math.round(48 * escalaBotones)

  return (
    <Pressable
      style={[
        styles.btn,
        { bottom: bottomOffset, width: tam, height: tam, borderRadius: tam / 2 },
        align === 'left' ? styles.left : styles.right,
        siguiendo && styles.btnActivo,
      ]}
      onPress={onPress}
      accessibilityLabel={siguiendo ? 'Siguiéndote en el mapa' : 'Centrar en mi ubicación'}
    >
      <Feather name="crosshair" size={Math.round(22 * escalaBotones)} color={siguiendo ? '#fff' : '#111827'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
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
  btnActivo: {
    backgroundColor: '#2563eb',
  },
})
