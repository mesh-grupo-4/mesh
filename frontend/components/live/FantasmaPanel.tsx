import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'
import type { EstadoFantasma } from '@/hooks/useFantasma'

type Props = {
  fantasma: EstadoFantasma
  onPausar: () => void
  onQuitar: () => void
}

function gapLegible(seg: number): string {
  const abs = Math.round(Math.abs(seg))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')} min` : `${s} s`
}

function metrosLegibles(m: number): string {
  const abs = Math.abs(m)
  return abs >= 1000 ? `${(abs / 1000).toFixed(2)} km` : `${Math.round(abs)} m`
}

/** RN-073 (SCRUM-49): adelante/atrás del fantasma, con pausar y quitar. */
export function FantasmaPanel({ fantasma, onPausar, onQuitar }: Props) {
  const theme = useTheme()
  const adelante = fantasma.deltaM >= 0
  const color = fantasma.terminado ? theme.textDim : adelante ? theme.good : theme.danger

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: '#7c3aed' }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>👻</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titulo, { color: theme.text }]} numberOfLines={1}>
            {fantasma.nombre} · {fantasma.autor}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={1}>
            {fantasma.pausado
              ? 'Fantasma en pausa'
              : fantasma.terminado
                ? 'El fantasma ya llegó'
                : `${fantasma.interpolado ? 'Ritmo estimado' : 'Recorrido real'} · ${Math.round(fantasma.progresoPct)} %`}
          </Text>
        </View>
        <Pressable onPress={onPausar} hitSlop={8} style={[styles.btn, { borderColor: theme.border }]} accessibilityLabel={fantasma.pausado ? 'Reanudar fantasma' : 'Pausar fantasma'}>
          <Feather name={fantasma.pausado ? 'play' : 'pause'} size={16} color={theme.text} />
        </Pressable>
        <Pressable onPress={onQuitar} hitSlop={8} style={[styles.btn, { borderColor: theme.border }]} accessibilityLabel="Quitar fantasma">
          <Feather name="x" size={16} color={theme.text} />
        </Pressable>
      </View>
      <Text style={[styles.delta, { color, fontSize: tamanoOutdoor(16) }]}>
        {adelante ? 'Vas adelante' : 'Vas atrás'} {metrosLegibles(fantasma.deltaM)} · {adelante ? '+' : '−'}
        {gapLegible(fantasma.gapSeg)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1.5, padding: 10, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 18 },
  titulo: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12 },
  btn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  delta: { marginTop: 6, fontWeight: '800' },
})
