import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { useTheme } from '@/components/MeshUI'

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
    onEnterSelection(itemId)
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
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
            {
              borderColor: selected ? theme.accent : theme.borderStrong,
              backgroundColor: selected ? theme.accent : 'transparent',
            },
          ]}
        >
          {selected ? <Feather name="check" size={14} color={theme.onAccent} /> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
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
  content: {
    flex: 1,
  },
})
