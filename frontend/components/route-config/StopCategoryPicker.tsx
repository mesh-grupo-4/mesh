import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/components/MeshUI'

import type { StopCategory } from './routeTypes'

type CategoryOption = {
  value: StopCategory
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

const OPTIONS: CategoryOption[] = [
  { value: 'kiosco', label: 'Kiosco', icon: 'storefront-outline' },
  { value: 'gastronomia', label: 'Restaurante', icon: 'restaurant-outline' },
  { value: 'combustible', label: 'Combustible', icon: 'car-outline' },
  { value: 'descanso', label: 'Descanso', icon: 'cafe-outline' },
  { value: 'punto_control', label: 'Punto de control', icon: 'flag-outline' },
  { value: 'otro', label: 'Otro', icon: 'ellipsis-horizontal' },
]

type Props = {
  value: StopCategory
  onChange: (category: StopCategory) => void
}

export function StopCategoryPicker({ value, onChange }: Props) {
  const theme = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.accent : theme.surface2,
                borderColor: selected ? theme.accentLine : theme.border,
              },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={selected ? theme.onAccent : theme.textDim}
            />
            <Text
              style={[
                styles.chipLabel,
                { color: selected ? theme.onAccent : theme.textDim },
                selected && styles.chipLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelSelected: {
    fontWeight: '700',
  },
})
