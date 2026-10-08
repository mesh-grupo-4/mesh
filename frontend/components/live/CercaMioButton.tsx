import { Pressable, StyleSheet, Text } from 'react-native'

import { uiConfigPorActividad } from '@/lib/activityUi'
import type { TipoActividadApi } from '@/lib/viajesApi'

type Props = {
  topOffset: number
  /** Hay una guía activa hacia un lugar: el botón pasa a "quitar guía". */
  guiaActiva: boolean
  onPress: () => void
  tipoActividad?: TipoActividadApi
}

/** Botón flotante (derecha, bajo el selector de estilo) para buscar lugares cerca mío. */
export function CercaMioButton({ topOffset, guiaActiva, onPress, tipoActividad = 'otro' }: Props) {
  const { escalaBotones } = uiConfigPorActividad(tipoActividad)
  const tam = Math.round(44 * escalaBotones)

  return (
    <Pressable
      style={({ pressed }) => [
        styles.boton,
        guiaActiva && styles.activo,
        { top: topOffset, width: tam, height: tam, borderRadius: tam / 2 },
        pressed && styles.presionado,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={guiaActiva ? 'Quitar la guía al lugar' : 'Buscar lugares cerca mío'}
    >
      <Text style={{ fontSize: Math.round(20 * escalaBotones) }}>{guiaActiva ? '✕' : '📍'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  boton: {
    position: 'absolute',
    right: 12,
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
  activo: {
    borderWidth: 2,
    borderColor: '#0e7490',
  },
  presionado: { opacity: 0.8 },
})
