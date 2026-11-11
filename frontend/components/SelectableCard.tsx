import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/Pressable'

import { useTheme } from '@/components/MeshUI'
import { SELECCION_CON_PULSACION_LARGA } from '@/lib/plataforma'

type Props = {
  itemId: string
  selectionActive: boolean
  selected: boolean
  disabled?: boolean
  onEnterSelection: (id: string) => void
  onToggle: (id: string) => void
  onPress?: () => void
  onDisabledPress?: () => void
  style?: StyleProp<ViewStyle>
  /** En tarjetas de grilla el check va flotando en la esquina en vez de a la izquierda. */
  checkEnEsquina?: boolean
  children: React.ReactNode
}

export function SelectableCard({
  itemId,
  selectionActive,
  selected,
  disabled = false,
  onEnterSelection,
  onToggle,
  onPress,
  onDisabledPress,
  style,
  checkEnEsquina = false,
  children,
}: Props) {
  const theme = useTheme()

  const handlePress = () => {
    if (selectionActive) {
      if (disabled) {
        onDisabledPress?.()
      } else {
        onToggle(itemId)
      }
      return
    }
    onPress?.()
  }

  const handleLongPress = () => {
    if (disabled) {
      onDisabledPress?.()
      return
    }
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
    // Ya seleccionando, la pulsación larga suma el ítem en vez de reiniciar la selección.
    if (selectionActive) onToggle(itemId)
    else onEnterSelection(itemId)
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={SELECCION_CON_PULSACION_LARGA ? handleLongPress : undefined}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.wrap,
        style,
        selectionActive && disabled && styles.disabled,
        selectionActive && selected && {
          borderColor: theme.accent,
          backgroundColor: theme.accentWeak,
        },
        pressed && { opacity: 0.92 },
      ]}
    >
      {selectionActive && !disabled ? (
        <View
          style={[
            styles.checkbox,
            checkEnEsquina && styles.checkboxEsquina,
            {
              borderColor: selected ? theme.accent : theme.borderStrong,
              backgroundColor: selected ? theme.accent : 'transparent',
            },
          ]}
        >
          {selected ? <Feather name="check" size={14} color={theme.onAccent} /> : null}
        </View>
      ) : null}
      <View style={[styles.content, checkEnEsquina && styles.contentEsquina]}>{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  disabled: {
    opacity: 0.55,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxEsquina: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  contentEsquina: {
    alignSelf: 'stretch',
  },
})
