import { useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'

type Busqueda = {
  value: string
  onChangeText: (texto: string) => void
  placeholder: string
  accessibilityLabel?: string
  maxLength?: number
  inputRef?: Ref<TextInput>
  /** Opcional: controla desde afuera si el campo está desplegado (ej. "Agregar amigo" lo abre). */
  abierto?: boolean
  onAbiertoChange?: (abierto: boolean) => void
}

type Filtros = {
  /** Cuántos filtros hay aplicados: resalta el botón y muestra "Limpiar". */
  cantidad: number
  onPress: () => void
  onLimpiar: () => void
}

/**
 * Fila de herramientas de los listados (Viajes, Entrenar, Grupos, Rutas): un
 * resumen a la izquierda y, a la derecha, la lupa y el botón "Filtros".
 * Scrollea con la lista: nada queda fijo arriba. La lupa despliega el campo de
 * búsqueda debajo de la fila; los filtros viven en su propia pantalla.
 */
export function HerramientasLista({
  resumen,
  acciones,
  busqueda,
  filtros,
  style,
}: {
  resumen?: string
  /** Botones extra antes de la lupa (ej. "Seleccionar"). */
  acciones?: ReactNode
  busqueda?: Busqueda
  filtros?: Filtros
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const [abiertoLocal, setAbiertoLocal] = useState(false)
  // Con texto escrito el campo nunca se esconde.
  const abierto =
    busqueda != null && ((busqueda.abierto ?? abiertoLocal) || busqueda.value.length > 0)

  const cambiarAbierto = (valor: boolean) => {
    if (!busqueda) return
    setAbiertoLocal(valor)
    busqueda.onAbiertoChange?.(valor)
  }

  // Cerrar la lupa también borra lo escrito: si no, la lista quedaría filtrada sin que se vea por qué.
  const alternarLupa = () => {
    if (!busqueda) return
    if (abierto) {
      busqueda.onChangeText('')
      cambiarAbierto(false)
    } else {
      cambiarAbierto(true)
    }
  }

  const conFiltros = (filtros?.cantidad ?? 0) > 0

  return (
    <View style={[styles.contenedor, style]}>
      <View style={styles.fila}>
        <Text style={[styles.resumen, { color: theme.textDim }]} numberOfLines={1}>
          {resumen ?? ''}
        </Text>

        {acciones}

        {busqueda ? (
          <Pressable
            onPress={alternarLupa}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={abierto ? 'Cerrar búsqueda' : 'Buscar'}
            style={({ pressed }) => [
              styles.lupa,
              {
                backgroundColor: abierto ? theme.accentWeak : pressed ? theme.surface2 : theme.surface,
                borderColor: abierto ? theme.accent : theme.border,
              },
            ]}
          >
            <Feather name={abierto ? 'x' : 'search'} size={17} color={abierto ? theme.accent : theme.text} />
          </Pressable>
        ) : null}

        {filtros ? (
          <Pressable
            onPress={filtros.onPress}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={conFiltros ? `Filtros, ${filtros.cantidad} aplicados` : 'Filtros'}
            style={({ pressed }) => [
              styles.botonFiltros,
              {
                backgroundColor: conFiltros ? theme.accentWeak : pressed ? theme.surface2 : theme.surface,
                borderColor: conFiltros ? theme.accent : theme.border,
              },
            ]}
          >
            <Feather name="sliders" size={15} color={conFiltros ? theme.accent : theme.text} />
            <Text style={[styles.botonFiltrosTexto, { color: conFiltros ? theme.accent : theme.text }]}>
              Filtros
            </Text>
            {conFiltros ? (
              <View style={[styles.contador, { backgroundColor: theme.accent }]}>
                <Text style={[styles.contadorTexto, { color: theme.onAccent }]}>{filtros.cantidad}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {conFiltros && filtros ? (
        <Pressable
          onPress={filtros.onLimpiar}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Limpiar filtros"
          style={styles.limpiar}
        >
          <Feather name="x-circle" size={14} color={theme.accent} />
          <Text style={[styles.limpiarTexto, { color: theme.accent }]}>Limpiar filtros</Text>
        </Pressable>
      ) : null}

      {abierto && busqueda ? (
        <Animated.View entering={FadeIn.duration(160)}>
          <BuscadorFiltros
            value={busqueda.value}
            onChangeText={busqueda.onChangeText}
            placeholder={busqueda.placeholder}
            accessibilityLabel={busqueda.accessibilityLabel}
            maxLength={busqueda.maxLength}
            inputRef={busqueda.inputRef}
            autoFocus={busqueda.value.length === 0}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

/** Campo de búsqueda. Lo despliega la lupa de `HerramientasLista`. */
export function BuscadorFiltros({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  maxLength,
  inputRef,
  autoFocus,
  style,
}: {
  value: string
  onChangeText: (texto: string) => void
  placeholder: string
  accessibilityLabel?: string
  maxLength?: number
  inputRef?: Ref<TextInput>
  autoFocus?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  return (
    <View style={[styles.buscador, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Feather name="search" size={16} color={theme.textMute} />
      <TextInput
        ref={inputRef}
        style={[styles.buscadorInput, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textMute}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={autoFocus}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
        >
          <Feather name="x-circle" size={16} color={theme.textMute} />
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
      contentContainerStyle={styles.chips}
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

const styles = StyleSheet.create({
  contenedor: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  resumen: { flex: 1, fontSize: 14, fontWeight: '600' },
  lupa: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonFiltros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  botonFiltrosTexto: { fontSize: 14.5, fontWeight: '700' },
  contador: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorTexto: { fontSize: 11, fontWeight: '800' },
  limpiar: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end' },
  limpiarTexto: { fontSize: 13.5, fontWeight: '700' },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  buscadorInput: { flex: 1, fontSize: 15, padding: 0 },
  chips: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6 },
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
})
