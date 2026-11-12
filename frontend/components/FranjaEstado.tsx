import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'

/**
 * En las pantallas donde todo scrollea (también el encabezado), tapa la zona
 * de la barra de estado para que el contenido no pase por debajo de la hora y
 * la batería. No es una barra: tiene el color del fondo y no se distingue.
 * Va como último hijo de la pantalla, para quedar por encima del scroll.
 * `visible={false}` la oculta mientras el scroll está arriba de todo (Perfil:
 * deja ver el fondo detrás de la hora).
 */
export function FranjaEstado({ visible = true }: { visible?: boolean }) {
  const theme = useTheme()
  const { top } = useSafeAreaInsets()
  if (!visible) return null
  return (
    <View
      pointerEvents="none"
      style={[styles.franja, { height: top, backgroundColor: theme.background }]}
    />
  )
}

const styles = StyleSheet.create({
  franja: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
})
