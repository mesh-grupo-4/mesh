import { Feather } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import type { PasoDefinicion } from '@/components/ayuda/contenidoAyuda'
import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'

const ALTO = 52

/**
 * Lo que una lista tiene que sumar a su `paddingBottom` (además del espacio de
 * la barra de pestañas) para que el botón flotante no tape la última tarjeta.
 */
export const ESPACIO_BOTON_FLOTANTE = ALTO + 12

type Props = {
  icon: React.ComponentProps<typeof Feather>['name']
  label: string
  onPress: () => void
  /** En false no se muestra (ej. mientras se seleccionan elementos para borrar). */
  visible?: boolean
  /** Paso del tour de ayuda que resalta este botón. */
  ayuda?: PasoDefinicion
}

/**
 * Acción principal de una pestaña ("Viaje YA", "Nuevo viaje", "Crear grupo"…):
 * flota abajo a la derecha, sobre la barra de pestañas, al alcance del pulgar.
 * Mismo lugar y mismo aspecto en todas las secciones.
 */
export function BotonFlotante({ icon, label, onPress, visible = true, ayuda }: Props) {
  const theme = useTheme()
  const espacioTabBar = useEspacioTabBar()

  if (!visible) return null

  const boton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        styles.sombra,
        { backgroundColor: theme.accent },
        pressed && styles.presionado,
      ]}
    >
      <Feather name={icon} size={20} color={theme.onAccent} />
      {/* 19 px en negrita: texto grande, legible en blanco sobre el acento de la marca. */}
      <Text style={[styles.texto, { color: theme.onAccent }]}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={[styles.contenedor, { bottom: espacioTabBar }]} pointerEvents="box-none">
      {ayuda ? <PasoAyuda {...ayuda}>{boton}</PasoAyuda> : boton}
    </View>
  )
}

/** Estilos compartidos con el "Viaje YA" de Inicio, que vive dentro de su propio dock. */
export const estilosBotonFlotante = StyleSheet.create({
  boton: {
    height: ALTO,
    paddingHorizontal: 20,
    borderRadius: ALTO / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  texto: { fontSize: 19, fontWeight: '800' },
  sombra: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  presionado: { opacity: 0.88 },
})

const styles = StyleSheet.create({
  ...estilosBotonFlotante,
  contenedor: { position: 'absolute', right: 16 },
})
