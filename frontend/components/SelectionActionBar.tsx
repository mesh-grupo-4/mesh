import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'

type Props = {
  visible: boolean
  count: number
  onDelete: () => void
  onCancel: () => void
  deleting?: boolean
}

export function SelectionActionBar({
  visible,
  count,
  onDelete,
  onCancel,
  deleting = false,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(160)}
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn}>
        <Text style={[styles.cancelText, { color: theme.textDim }]}>Cancelar</Text>
      </Pressable>

      <Text style={[styles.count, { color: theme.text }]}>
        {count === 0 ? 'Ninguno seleccionado' : `${count} seleccionado${count === 1 ? '' : 's'}`}
      </Text>

      <Pressable
        onPress={onDelete}
        disabled={count === 0 || deleting}
        style={[
          styles.deleteBtn,
          { backgroundColor: count === 0 || deleting ? theme.surface2 : theme.danger },
        ]}
        hitSlop={8}
      >
        {deleting ? (
          <Feather name="loader" size={20} color="#fff" />
        ) : (
          <Feather
            name="trash-2"
            size={20}
            color={count === 0 ? theme.textMute : '#fff'}
          />
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  count: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
