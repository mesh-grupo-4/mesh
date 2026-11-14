import { Feather } from '@expo/vector-icons'
import { StyleSheet } from 'react-native'
import { Pressable } from '@/components/Pressable'

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
      {/* `key`: el ícono se monta de nuevo en cada cambio de estado. */}
      <Feather
        key={guiaActiva ? 'quitar' : 'buscar'}
        name={guiaActiva ? 'x' : 'map-pin'}
        size={Math.round(22 * escalaBotones)}
        color={guiaActiva ? '#0e7490' : '#1f2937'}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // El borde está siempre (blanco = invisible) y solo cambia de color: quitarlo
  // al cerrar la guía cambiaba el layout y en Android (Fabric) el ícono no se
  // volvía a dibujar, quedaba el círculo blanco vacío.
  boton: {
    position: 'absolute',
    right: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
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
    borderColor: '#0e7490',
  },
  presionado: { opacity: 0.8 },
})
