import { useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
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

/** Transición compartida: la lupa se estira y "Filtros" se corre a la derecha al mismo ritmo. */
const TRANSICION = LinearTransition.duration(240)

/**
 * Fila de herramientas de los listados (Viajes, Entrenar, Grupos, Rutas): a la
 * izquierda la lupa y el botón "Filtros", a la derecha el resumen.
 * Scrollea con la lista: nada queda fijo arriba. La lupa se estira en la misma
 * fila hasta ser el campo de búsqueda, empujando "Filtros" a la derecha y
 * ocultando el resumen hasta que se vuelve a cerrar. Los filtros viven en su
 * propia pantalla.
 */
export function HerramientasLista({
  resumen,
  acciones,
  busqueda,
  filtros,
  style,
}: {
  resumen?: string
  /** Botones extra al final de la fila (ej. "Seleccionar"). */
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

  // Cerrar la búsqueda también borra lo escrito: si no, la lista quedaría filtrada sin que se vea por qué.
  const cerrarBusqueda = () => {
    if (!busqueda) return
    Keyboard.dismiss()
    busqueda.onChangeText('')
    cambiarAbierto(false)
  }

  const conFiltros = (filtros?.cantidad ?? 0) > 0

  return (
    <View style={[styles.contenedor, style]}>
      <View style={styles.fila}>
        {busqueda ? (
          <Animated.View
            layout={TRANSICION}
            style={[
              styles.buscador,
              abierto ? styles.buscadorAbierto : styles.buscadorCerrado,
              {
                backgroundColor: theme.surface,
                borderColor: abierto ? theme.accent : theme.border,
              },
            ]}
          >
            {abierto ? (
              <>
                <Feather name="search" size={17} color={theme.textMute} />
                <TextInput
                  ref={busqueda.inputRef}
                  style={[styles.buscadorInput, { color: theme.text }]}
                  placeholder={busqueda.placeholder}
                  placeholderTextColor={theme.textMute}
                  value={busqueda.value}
                  onChangeText={busqueda.onChangeText}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoFocus={busqueda.value.length === 0}
                  maxLength={busqueda.maxLength}
                  accessibilityLabel={busqueda.accessibilityLabel}
                />
                <Pressable
                  onPress={cerrarBusqueda}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar búsqueda"
                  style={styles.cerrarBusqueda}
                >
                  <Feather name="x" size={17} color={theme.accent} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => cambiarAbierto(true)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Buscar"
                style={({ pressed }) => [styles.lupaToque, pressed && { backgroundColor: theme.surface2 }]}
              >
                <Feather name="search" size={17} color={theme.text} />
              </Pressable>
            )}
          </Animated.View>
        ) : null}

        {filtros ? (
          <Animated.View layout={TRANSICION}>
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
          </Animated.View>
        ) : null}

        {/* El resumen se va mientras la búsqueda está abierta y vuelve al cerrarla. */}
        {!abierto ? (
          <Animated.View
            entering={FadeIn.duration(180).delay(80)}
            exiting={FadeOut.duration(100)}
            style={styles.resumenCaja}
          >
            <Text style={[styles.resumen, { color: theme.textDim }]} numberOfLines={1}>
              {resumen ?? ''}
            </Text>
          </Animated.View>
        ) : null}

        {acciones ? <Animated.View layout={TRANSICION}>{acciones}</Animated.View> : null}
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
  resumenCaja: { flex: 1 },
  resumen: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  buscador: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Cerrada es la lupa redonda; abierta ocupa todo el ancho libre de la fila.
  // El padding izquierdo deja el ícono en el mismo lugar en ambos estados.
  buscadorCerrado: { width: 40 },
  buscadorAbierto: { flex: 1, paddingLeft: 10.5, paddingRight: 4, gap: 8 },
  lupaToque: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  buscadorInput: { flex: 1, fontSize: 15, padding: 0 },
  cerrarBusqueda: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
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
  limpiar: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  limpiarTexto: { fontSize: 13.5, fontWeight: '700' },
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
