import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Btn, useTheme } from '@/components/MeshUI'

type Props = {
  destinoNombre: string
  esCreador: boolean
  ocupado?: boolean
  onContinuar: () => void
  onFinalizar?: () => void
  onSalir?: () => void
}

/** Banner tipo Google Maps cuando el usuario llega al destino. */
export function LlegadaDestinoBanner({
  destinoNombre,
  esCreador,
  ocupado = false,
  onContinuar,
  onFinalizar,
  onSalir,
}: Props) {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
      ]}
    >
      <View style={styles.iconRow}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentWeak }]}>
          <Feather name="flag" size={22} color={theme.accent} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: theme.text }]}>¡Llegaste!</Text>
          <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={2}>
            {destinoNombre}
          </Text>
        </View>
        <Pressable
          onPress={onContinuar}
          hitSlop={12}
          accessibilityLabel="Seguir un rato"
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={20} color={theme.textMute} />
        </Pressable>
      </View>

      {esCreador && onFinalizar ? (
        <Btn variant="primary" block disabled={ocupado} onPress={onFinalizar} style={styles.cta}>
          Finalizar viaje para todos
        </Btn>
      ) : null}

      {!esCreador && onSalir ? (
        <Btn variant="outline" block disabled={ocupado} onPress={onSalir} style={styles.cta}>
          Finalizar mi participación
        </Btn>
      ) : null}

      <Btn variant="ghost" block onPress={onContinuar} style={styles.ctaGhost}>
        Seguir un rato
      </Btn>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  closeBtn: {
    padding: 4,
  },
  cta: {
    marginTop: 4,
  },
  ctaGhost: {
    marginTop: 2,
  },
})
