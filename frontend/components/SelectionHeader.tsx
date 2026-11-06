import { StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'

import { useTheme } from '@/components/MeshUI'
import { SELECCION_CON_PULSACION_LARGA } from '@/lib/plataforma'

type Props = {
  visible: boolean
  allSelected: boolean
  onToggleAll: () => void
  onCancel: () => void
}

/**
 * Entrada al modo selección en iOS, donde la pulsación larga no selecciona.
 * En Android no se dibuja: ahí se entra manteniendo apretado un elemento.
 */
export function BotonSeleccionar({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const theme = useTheme()

  if (!visible || SELECCION_CON_PULSACION_LARGA) return null

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.seleccionar}
      accessibilityRole="button"
    >
      <Text style={[styles.seleccionarTexto, { color: theme.accent }]}>Seleccionar</Text>
    </Pressable>
  )
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
  seleccionar: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
  seleccionarTexto: {
    fontSize: 15,
    fontWeight: '600',
  },
})
