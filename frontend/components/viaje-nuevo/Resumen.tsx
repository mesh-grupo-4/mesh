import { Feather } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'

/**
 * Resumen "una fila por lo elegido" (actividad, cuándo, recorrido, con quién…).
 * Lo usan el último paso de "Planificar viaje" y la sala de espera del Viaje YA.
 */
export function TarjetaResumen({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <View style={[styles.tarjeta, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
}

export function FilaResumen({
  icon,
  leading,
  etiqueta,
  valor,
  capitalizar = false,
  ultima = false,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap
  leading?: ReactNode
  etiqueta: string
  valor: string
  capitalizar?: boolean
  ultima?: boolean
  /** Sin `onPress` la fila es solo informativa (ej. lo que impone una plantilla). */
  onPress?: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Cambiar ${etiqueta}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.fila, !ultima && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
    >
      <View style={styles.icono}>
        {leading ?? <Feather name={icon ?? 'circle'} size={20} color={theme.accent} />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.etiqueta, { color: theme.textDim }]} numberOfLines={1}>
          {etiqueta}
        </Text>
        <Text style={[styles.valor, { color: theme.text }, capitalizar && styles.capitalizar]} numberOfLines={2}>
          {valor}
        </Text>
      </View>
      {onPress ? <Feather name="edit-2" size={16} color={theme.textMute} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  icono: { width: 32, alignItems: 'center' },
  flex: { flex: 1 },
  etiqueta: { fontSize: 13, fontWeight: '600' },
  valor: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  capitalizar: { textTransform: 'capitalize' },
})
