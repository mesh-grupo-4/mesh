import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BalanceCard, GastoFila } from '@/components/gastos/GastoCards'
import { useTheme } from '@/components/MeshUI'
import {
  listarGastos,
  obtenerBalanceGastos,
  type BalanceGastosApi,
  type GastoApi,
} from '@/lib/gastosApi'

/** Pestaña de gastos del cierre: con el viaje finalizado es solo lectura. */
export function GastosCierrePanel({ viajeId }: { viajeId: string }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [gastos, setGastos] = useState<GastoApi[]>([])
  const [balance, setBalance] = useState<BalanceGastosApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [lista, saldo] = await Promise.all([
        listarGastos(viajeId),
        obtenerBalanceGastos(viajeId),
      ])
      setGastos(lista)
      setBalance(saldo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los gastos.')
    } finally {
      setCargando(false)
    }
  }, [viajeId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <ScrollView
      contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => void cargar()} />}
    >
      {error ? (
        <View style={styles.vacio}>
          <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>
            No se pudieron cargar los gastos
          </Text>
          <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
            {error} Deslizá hacia abajo para reintentar.
          </Text>
        </View>
      ) : null}

      {!error && !cargando && gastos.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={[styles.vacioTitulo, { color: theme.textDim }]}>Sin gastos compartidos</Text>
          <Text style={[styles.vacioTxt, { color: theme.textMute }]}>
            En este viaje no se registró ningún gasto.
          </Text>
        </View>
      ) : null}

      {!error && gastos.length > 0 ? <BalanceCard balance={balance} theme={theme} /> : null}

      {gastos.map((g) => (
        <GastoFila key={g.id} gasto={g} theme={theme} soloLectura />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  lista: { padding: 16, gap: 10 },
  vacio: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  vacioTxt: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
