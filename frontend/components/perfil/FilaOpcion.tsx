import { StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { Pressable } from '@/components/Pressable'
import { useTheme } from '@/components/MeshUI'

type Props = {
  icono: keyof typeof Feather.glyphMap
  titulo: string
  subtitulo?: string
  onPress: () => void
  badge?: number
  peligro?: boolean
  disabled?: boolean
}

/** Opción de la lista del Perfil: ícono, título y subtítulo, sin tarjeta. */
export function FilaOpcion({ icono, titulo, subtitulo, onPress, badge = 0, peligro, disabled }: Props) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={subtitulo ? `${titulo}. ${subtitulo}` : titulo}
      style={({ pressed }) => [styles.fila, pressed && { backgroundColor: theme.surface2 }]}
    >
      <Feather name={icono} size={24} color={peligro ? theme.danger : theme.textDim} />
      <View style={styles.textos}>
        <Text style={[styles.titulo, { color: peligro ? theme.danger : theme.text }]}>{titulo}</Text>
        {subtitulo ? (
          <Text style={[styles.subtitulo, { color: theme.textDim }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeTexto, { color: theme.onAccent }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    minHeight: 72,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 17,
    fontWeight: '500',
  },
  subtitulo: {
    fontSize: 14,
  },
  badge: {
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
})
