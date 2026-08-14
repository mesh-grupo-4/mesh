import { Feather } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

type Props = {
  icon: keyof typeof Feather.glyphMap
  /** Ya formateado. Usar '--' cuando el dato no existe, nunca '0'. */
  value: string
  label: string
  /** Aclaración al pie, en chico. */
  hint?: string
}

export function StatCard({ icon, value, label, hint }: Props) {
  const theme = useTheme()

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Feather name={icon} size={18} color={theme.accent} style={styles.icon} />
      <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.textDim }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textMute }]}>{hint}</Text> : null}
    </View>
  )
}

export function StatCardRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'flex-start',
  },
  icon: {
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 10.5,
    marginTop: 4,
    lineHeight: 14,
  },
})
