<<<<<<< Updated upstream
import type { ComponentProps, ReactNode, Ref } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
=======
import type { ComponentProps, ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  inputRef,
=======
  style,
>>>>>>> Stashed changes
}: {
  value: string
  onChangeText: (texto: string) => void
  placeholder: string
  accessibilityLabel?: string
  maxLength?: number
<<<<<<< Updated upstream
  inputRef?: Ref<TextInput>
=======
  style?: StyleProp<ViewStyle>
>>>>>>> Stashed changes
}) {
  const theme = useTheme()
  return (
    <View style={[styles.buscador, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Feather name="search" size={15} color={theme.textMute} />
      <TextInput
        ref={inputRef}
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

/** Buscador y botón de filtros en una misma fila. */
export function FilaBuscadorFiltros({ children }: { children: ReactNode }) {
  return <View style={styles.filaBuscador}>{children}</View>
}

/**
 * Abre la hoja de filtros. Con filtros aplicados se resalta y muestra cuántos hay,
 * para que nunca quede una lista recortada sin que se note.
 */
export function BotonFiltros({ cantidad, onPress }: { cantidad: number; onPress: () => void }) {
  const theme = useTheme()
  const activo = cantidad > 0
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={activo ? `Filtros, ${cantidad} aplicados` : 'Filtros'}
      style={[
        styles.botonFiltros,
        {
          backgroundColor: activo ? theme.accentWeak : theme.surface,
          borderColor: activo ? theme.accent : theme.border,
        },
      ]}
    >
      <Feather name="sliders" size={15} color={activo ? theme.accent : theme.textDim} />
      <Text style={[styles.botonFiltrosTexto, { color: activo ? theme.accent : theme.textDim }]}>
        Filtros
      </Text>
      {activo ? (
        <View style={[styles.contador, { backgroundColor: theme.accent }]}>
          <Text style={[styles.contadorTexto, { color: theme.onAccent }]}>{cantidad}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

/** Un filtro aplicado: tocarlo lo quita. */
export function PastillaFiltro({ etiqueta, onQuitar }: { etiqueta: string; onQuitar: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onQuitar}
      accessibilityRole="button"
      accessibilityLabel={`Quitar filtro ${etiqueta}`}
      style={[styles.pastilla, { backgroundColor: theme.accentWeak, borderColor: theme.accentLine }]}
    >
      <Text style={[styles.pastillaTexto, { color: theme.accent }]} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Feather name="x" size={13} color={theme.accent} />
    </Pressable>
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
  filaBuscador: { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: 16, gap: 8 },
  botonFiltros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  botonFiltrosTexto: { fontSize: 14, fontWeight: '700' },
  contador: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorTexto: { fontSize: 11, fontWeight: '800' },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 9,
    paddingVertical: 6,
    maxWidth: 220,
  },
  pastillaTexto: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
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
