import type { ReactNode } from 'react'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'

type Props = {
  visible: boolean
  titulo?: string
  onCerrar: () => void
  /** Deja el borrador sin filtros (no aplica: eso lo hace el botón de abajo). */
  onLimpiar: () => void
  puedeLimpiar: boolean
  /** Texto del botón de abajo, ej. "Ver 8 viajes". */
  textoAplicar: string
  onAplicar: () => void
  children: ReactNode
}

/**
 * Pantalla completa de filtros, compartida por Viajes, Entrenar y Rutas.
 * Trabaja sobre un borrador: los cambios se aplican recién con el botón de
 * abajo; volver los descarta.
 */
export function PantallaFiltros({
  visible,
  titulo = 'Filtros',
  onCerrar,
  onLimpiar,
  puedeLimpiar,
  textoAplicar,
  onAplicar,
  children,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCerrar}
    >
      <View style={[styles.raiz, { backgroundColor: theme.background }]}>
        <TopBar
          title={titulo}
          onBack={onCerrar}
          right={
            <Pressable
              onPress={onLimpiar}
              disabled={!puedeLimpiar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !puedeLimpiar }}
            >
              <Text style={[styles.limpiar, { color: puedeLimpiar ? theme.accent : theme.textMute }]}>
                Limpiar
              </Text>
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        <View
          style={[
            styles.pie,
            { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Btn block size="lg" onPress={onAplicar}>
            {textoAplicar}
          </Btn>
        </View>
      </View>
    </Modal>
  )
}

export function SeccionFiltro({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionCabecera}>
        <Text style={[styles.seccionTitulo, { color: theme.text }]}>{titulo}</Text>
        {ayuda ? <Text style={[styles.seccionAyuda, { color: theme.textMute }]}>{ayuda}</Text> : null}
      </View>
      {children}
    </View>
  )
}

/** Contenedor de `OpcionFiltro` que se acomodan en varias líneas. */
export function OpcionesFiltro({ children }: { children: ReactNode }) {
  return <View style={styles.opciones}>{children}</View>
}

/** Opción tipo chip, con tamaño de toque cómodo para usar en exteriores (RN-052). */
export function OpcionFiltro({
  etiqueta,
  activa,
  onPress,
  icono,
  multiple = false,
}: {
  etiqueta: string
  activa: boolean
  onPress: () => void
  icono?: ReactNode
  /** Selección múltiple (checkbox) o única (radio), para el lector de pantalla. */
  multiple?: boolean
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: activa } : { selected: activa }}
      style={[
        styles.opcion,
        {
          backgroundColor: activa ? theme.accentWeak : theme.surface,
          borderColor: activa ? theme.accent : theme.border,
        },
      ]}
    >
      {icono}
      <Text style={[styles.opcionTexto, { color: activa ? theme.accent : theme.text }]}>{etiqueta}</Text>
      {activa ? <Feather name="check" size={15} color={theme.accent} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  limpiar: { fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  contenido: { padding: 20, gap: 26, paddingBottom: 32 },
  seccion: { gap: 12 },
  seccionCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  seccionTitulo: { fontSize: 16, fontWeight: '800' },
  seccionAyuda: { fontSize: 13 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  opcionTexto: { fontSize: 15, fontWeight: '600' },
  pie: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
})
