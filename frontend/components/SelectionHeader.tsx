import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

type Props = {
  visible: boolean
  allSelected: boolean
  onToggleAll: () => void
  onCancel: () => void
}

export function SelectionHeader({ visible, allSelected, onToggleAll, onCancel }: Props) {
  const theme = useTheme()

  if (!visible) return null

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={[styles.link, { color: theme.textDim }]}>Cancelar</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]}>Seleccionar</Text>
      <Pressable onPress={onToggleAll} hitSlop={8}>
        <Text style={[styles.link, { color: theme.accent }]}>
          {allSelected ? 'Ninguno' : 'Todos'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 72,
  },
})
