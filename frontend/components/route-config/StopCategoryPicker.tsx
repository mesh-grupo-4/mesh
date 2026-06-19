import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

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
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Ionicons name={opt.icon} size={16} color={selected ? '#fff' : '#374151'} />
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{opt.label}</Text>
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
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipLabelSelected: {
    color: '#fff',
  },
})
