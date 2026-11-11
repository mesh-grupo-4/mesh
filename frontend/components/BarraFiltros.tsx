import type { ComponentProps, ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'

/**
 * Buscador + chips de filtro de las pantallas de listado (Viajes, Rutas).
 * Va fijo arriba de la lista, fuera del scroll, para que el diseño sea el mismo en todas.
 */
export function BarraFiltros({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <View
      style={[styles.barra, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
    >
      {children}
    </View>
  )
}

export function BuscadorFiltros({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  maxLength,
}: {
  value: string
  onChangeText: (texto: string) => void
  placeholder: string
  accessibilityLabel?: string
  maxLength?: number
}) {
  const theme = useTheme()
  return (
    <View style={[styles.buscador, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Feather name="search" size={15} color={theme.textMute} />
      <TextInput
        style={[styles.buscadorInput, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textMute}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
        >
          <Feather name="x-circle" size={15} color={theme.textMute} />
        </Pressable>
      )}
    </View>
  )
}

/** Fila de chips con scroll horizontal. */
export function FilaChipsFiltro({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.fila}
    >
      {children}
    </ScrollView>
  )
}

export function ChipFiltro({
  label,
  activo,
  onPress,
  icon,
}: {
  label: string
  activo: boolean
  onPress: () => void
  icon?: ComponentProps<typeof Feather>['name']
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[
        styles.chip,
        { borderColor: activo ? theme.accent : theme.border },
        activo && { backgroundColor: theme.accent },
      ]}
    >
      {icon ? <Feather name={icon} size={12} color={activo ? '#fff' : theme.textDim} /> : null}
      <Text style={[styles.chipTexto, { color: activo ? '#fff' : theme.textDim }]}>{label}</Text>
    </Pressable>
  )
}

/** Separador vertical entre dos grupos de chips de una misma fila. */
export function DivisorChipsFiltro() {
  const theme = useTheme()
  return <View style={[styles.divisor, { backgroundColor: theme.border }]} />
}

export function BotonLimpiarFiltros({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable style={styles.limpiar} onPress={onPress} accessibilityRole="button">
      <Feather name="x" size={12} color={theme.textMute} />
      <Text style={[styles.limpiarTexto, { color: theme.textMute }]}>Limpiar</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  barra: { borderBottomWidth: 1, paddingTop: 10, paddingBottom: 12, gap: 8 },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  buscadorInput: { flex: 1, fontSize: 14, padding: 0 },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipTexto: { fontSize: 12.5, fontWeight: '600' },
  divisor: { width: 1, height: 20, marginHorizontal: 2 },
  limpiar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  limpiarTexto: { fontSize: 12, fontWeight: '600' },
})
