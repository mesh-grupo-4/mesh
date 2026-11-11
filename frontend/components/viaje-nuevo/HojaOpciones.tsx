import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DragToDismiss } from '@/components/DragToDismiss'
import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'

/**
 * Hoja inferior con opciones grandes, para pantallas presentadas como modal
 * transparente ("Nuevo viaje", "Repetir entrenamiento"). Tocar afuera o
 * arrastrarla hacia abajo vuelve a la pantalla anterior.
 */
export function HojaOpciones({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.root}>
      <Pressable
        feedback={false}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
        onPress={() => router.back()}
        accessibilityLabel="Cerrar"
      />

      <DragToDismiss
        onDismiss={() => router.back()}
        style={[
          styles.sheet,
          { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
        <View style={styles.encabezado}>
          <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
          {subtitulo ? <Text style={[styles.subtitulo, { color: theme.textDim }]}>{subtitulo}</Text> : null}
        </View>
        {children}
      </DragToDismiss>
    </View>
  )
}

export function OpcionHoja({
  icon,
  titulo,
  detalle,
  destacada = false,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  titulo: string
  detalle: string
  destacada?: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.opcion,
        destacada
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.opcionIcono,
          { backgroundColor: destacada ? 'rgba(255,255,255,0.2)' : theme.accentWeak },
        ]}
      >
        <Feather name={icon} size={26} color={destacada ? theme.onAccent : theme.accent} />
      </View>
      <View style={styles.opcionTexto}>
        <Text style={[styles.opcionTitulo, { color: destacada ? theme.onAccent : theme.text }]}>
          {titulo}
        </Text>
        <Text style={[styles.opcionDetalle, { color: destacada ? theme.onAccent : theme.textDim }]}>
          {detalle}
        </Text>
      </View>
      <Feather name="chevron-right" size={22} color={destacada ? theme.onAccent : theme.textMute} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 6 },
  encabezado: { gap: 2, marginBottom: 4 },
  titulo: { fontSize: 22, fontWeight: '800' },
  subtitulo: { fontSize: 15, lineHeight: 20 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    minHeight: 88,
  },
  opcionIcono: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opcionTexto: { flex: 1, gap: 2 },
  opcionTitulo: { fontSize: 19, fontWeight: '800' },
  opcionDetalle: { fontSize: 14, lineHeight: 19 },
})
