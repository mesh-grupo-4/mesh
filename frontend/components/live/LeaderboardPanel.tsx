import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'
import type { FilaLeaderboardApi } from '@/lib/viajesApi'

type Props = {
  filas: FilaLeaderboardApi[]
  currentUserId: string
}

function gap(seg: number): string {
  const s = Math.round(seg)
  const m = Math.floor(s / 60)
  return m > 0 ? `+${m}:${(s % 60).toString().padStart(2, '0')}` : `+${s} s`
}

/** RN-071 (SCRUM-51): clasificación en vivo del modo competitivo. */
export function LeaderboardPanel({ filas, currentUserId }: Props) {
  const theme = useTheme()
  const [abierto, setAbierto] = useState(true)
  const mia = filas.find((f) => f.usuarioId === currentUserId)
  const visibles = abierto ? filas.slice(0, 6) : []

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable onPress={() => setAbierto((v) => !v)} style={styles.header} accessibilityRole="button">
        <Feather name="award" size={15} color={theme.accent} />
        <Text style={[styles.titulo, { color: theme.text }]}>Clasificación</Text>
        {mia ? (
          <Text style={[styles.miPuesto, { color: theme.accent }]}>
            {mia.puesto}º{mia.deltaM > 0 ? ` · ${gap(mia.gapSeg)}` : ''}
          </Text>
        ) : null}
        <Feather name={abierto ? 'chevron-up' : 'chevron-down'} size={15} color={theme.textDim} />
      </Pressable>
      {visibles.map((f) => {
        const soyYo = f.usuarioId === currentUserId
        return (
          <View key={f.usuarioId} style={styles.fila}>
            <Text style={[styles.puesto, { color: f.puesto === 1 ? theme.accent : theme.textDim }]}>{f.puesto}</Text>
            <Text
              style={[styles.nombre, { color: theme.text, fontWeight: soyYo ? '800' : '600', fontSize: tamanoOutdoor(13) }]}
              numberOfLines={1}
            >
              {f.nombre}
              {soyYo ? ' (vos)' : ''}
            </Text>
            <Text style={[styles.gap, { color: f.deltaM === 0 ? theme.good : theme.textDim }]}>
              {f.deltaM === 0 ? 'líder' : `${Math.round(f.deltaM)} m · ${gap(f.gapSeg)}`}
            </Text>
          </View>
        )
      })}
      {abierto && filas.length === 0 ? (
        <Text style={[styles.vacio, { color: theme.textDim }]}>Esperando posiciones del grupo…</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700' },
  miPuesto: { fontSize: 13, fontWeight: '800', marginRight: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  puesto: { width: 18, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  nombre: { flex: 1 },
  gap: { fontSize: 12, fontVariant: ['tabular-nums'] },
  vacio: { fontSize: 12, marginTop: 6 },
})
