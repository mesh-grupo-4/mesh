import { Pressable, StyleProp, StyleSheet, ViewStyle, useColorScheme } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useCopilot } from 'react-native-copilot'
import Colors from '@/constants/Colors'

// No importamos `useTheme` de `@/components/MeshUI`: ese archivo importa este
// componente para integrarlo a `TopBar`, e importar de vuelta crearía un ciclo.
function useTemaAyuda(altoContraste?: boolean) {
  const scheme = useColorScheme()
  if (altoContraste) return Colors.highContrast
  return Colors[scheme === 'light' ? 'light' : 'dark']
}

type Props = {
  /** Si se pasa, reemplaza el arranque automático del tour (uso desde `TopBar`). */
  onPress?: () => void
  size?: number
  altoContraste?: boolean
  style?: StyleProp<ViewStyle>
}

/** Botón "?" que dispara el tour de ayuda de la pantalla actual.
 *
 * Por defecto arranca desde el primer paso registrado (`start()` sin
 * argumentos): como `PasoAyuda` solo registra los pasos de la pantalla
 * enfocada, alcanza con eso para empezar siempre por el paso de menor `orden`
 * de la pantalla donde se tocó el botón. */
export function BotonAyuda({ onPress, size = 40, altoContraste, style }: Props) {
  const theme = useTemaAyuda(altoContraste)
  const { start } = useCopilot()

  return (
    <Pressable
      onPress={onPress ?? (() => void start())}
      accessibilityRole="button"
      accessibilityLabel="Ver ayuda de esta pantalla"
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed ? theme.surface2 : theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <Feather name="help-circle" size={Math.round(size * 0.5)} color={theme.accent} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
