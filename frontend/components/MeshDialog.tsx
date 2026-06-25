import { Feather } from '@expo/vector-icons'
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Btn, useTheme } from '@/components/MeshUI'

export type MeshDialogVariant = 'default' | 'destructive' | 'success' | 'warning'

export type MeshDialogButton = {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline'
  loading?: boolean
}

type Props = {
  visible: boolean
  title: string
  message?: string
  variant?: MeshDialogVariant
  buttons: MeshDialogButton[]
  onRequestClose?: () => void
}

function variantIcon(variant: MeshDialogVariant): keyof typeof Feather.glyphMap | null {
  switch (variant) {
    case 'destructive':
      return 'alert-triangle'
    case 'success':
      return 'check-circle'
    case 'warning':
      return 'alert-circle'
    default:
      return null
  }
}

function variantColor(variant: MeshDialogVariant, theme: ReturnType<typeof useTheme>): string {
  switch (variant) {
    case 'destructive':
      return theme.danger
    case 'success':
      return theme.good
    case 'warning':
      return theme.accent
    default:
      return theme.accent
  }
}

export function MeshDialog({
  visible,
  title,
  message,
  variant = 'default',
  buttons,
  onRequestClose,
}: Props) {
  const theme = useTheme()
  const icon = variantIcon(variant)
  const accent = variantColor(variant, theme)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
              <Feather name={icon} size={22} color={accent} />
            </View>
          ) : null}

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          {message ? (
            <ScrollView
              style={styles.messageScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.message, { color: theme.textDim }]}>{message}</Text>
            </ScrollView>
          ) : null}

          <View style={[styles.actions, buttons.length > 2 && styles.actionsStack]}>
            {buttons.map((btn, i) => (
              <Btn
                key={`${btn.label}-${i}`}
                variant={btn.variant ?? (i === buttons.length - 1 ? 'primary' : 'ghost')}
                onPress={btn.onPress}
                loading={btn.loading}
                disabled={btn.loading}
                block={buttons.length > 2}
                style={buttons.length <= 2 ? styles.actionBtn : undefined}
              >
                {btn.label}
              </Btn>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: Platform.OS === 'ios' ? 40 : 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: '80%',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  messageScroll: {
    maxHeight: 220,
    marginTop: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  actionsStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionBtn: {
    minWidth: 88,
  },
})
