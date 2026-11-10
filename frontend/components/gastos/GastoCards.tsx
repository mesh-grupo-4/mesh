import { Feather } from '@expo/vector-icons'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { Badge, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import type { BalanceGastosApi, GastoApi } from '@/lib/gastosApi'
import { formatearEnArg } from '@/lib/tiempoArg'

type Theme = ReturnType<typeof useTheme>

function formatMonto(n: number): string {
  return `$${n.toFixed(2)}`
}

export function GastoFila({
  gasto,
  theme,
  soloLectura,
  enEdicion = false,
  onEditar,
  onEliminar,
}: {
  gasto: GastoApi
  theme: Theme
  soloLectura: boolean
  enEdicion?: boolean
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const fecha = formatearEnArg(gasto.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, '')

  return (
    <View
      style={[
        styles.gasto,
        {
          backgroundColor: theme.surface,
          borderColor: enEdicion ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={styles.gastoHead}>
        <Text style={[styles.gastoDescripcion, { color: theme.text }]} numberOfLines={2}>
          {gasto.descripcion}
        </Text>
        <Text style={[styles.gastoMonto, { color: theme.text }]}>{formatMonto(gasto.monto)}</Text>
      </View>

      <Text style={[styles.gastoMeta, { color: theme.textMute }]}>
        Pagó {gasto.usuario_nombre} · {fecha}
      </Text>

      <View style={styles.gastoPie}>
        <Badge tone="mute">
          {formatMonto(gasto.monto_por_persona)} × {gasto.participantes.length}{' '}
          {gasto.participantes.length === 1 ? 'persona' : 'personas'}
        </Badge>

        {!soloLectura && gasto.puede_editar ? (
          <View style={styles.gastoAcciones}>
            <Pressable onPress={onEditar} hitSlop={8} style={styles.accionBtn}>
              <Feather name="edit-2" size={16} color={theme.textMute} />
            </Pressable>
            <Pressable onPress={onEliminar} hitSlop={8} style={styles.accionBtn}>
              <Feather name="trash-2" size={16} color={theme.textMute} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function BalanceCard({ balance, theme }: { balance: BalanceGastosApi | null; theme: Theme }) {
  if (!balance) {
    return (
      <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.balanceTitulo, { color: theme.text }]}>Balance final</Text>

      {balance.transacciones.length === 0 ? (
        <Text style={[styles.balanceVacio, { color: theme.textMute }]}>
          Todos pagaron su parte: no hay nada que saldar.
        </Text>
      ) : (
        balance.transacciones.map((t, i) => (
          <Text key={i} style={[styles.balanceLinea, { color: theme.textDim }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t.de_nombre}</Text> le debe{' '}
            <Text style={{ color: theme.text, fontWeight: '700' }}>{formatMonto(t.monto)}</Text> a{' '}
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t.para_nombre}</Text>
          </Text>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  balanceCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  balanceTitulo: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  balanceVacio: { fontSize: 14, lineHeight: 20 },
  balanceLinea: { fontSize: 14, lineHeight: 21 },

  gasto: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  gastoHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  gastoDescripcion: { flex: 1, fontSize: 15, fontWeight: '600' },
  gastoMonto: { fontSize: 15, fontWeight: '800' },
  gastoMeta: { fontSize: 12.5 },
  gastoPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  gastoAcciones: { flexDirection: 'row', gap: 4 },
  accionBtn: { padding: 4 },
})
