import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  BalanceCard,
  FiltrosGastos,
  filtrarGastos,
  GastoFila,
  ResumenGastosCard,
  type FiltroGastos,
} from '@/components/gastos/GastoCards'
import { useTheme } from '@/components/MeshUI'
import { DEV_USER_ID } from '@/constants/Config'
import { useAuth } from '@/context/AuthContext'
import {
  listarGastos,
  obtenerBalanceGastos,
  type BalanceGastosApi,
  type GastoApi,
} from '@/lib/gastosApi'

/**
 * Pestaña de gastos del cierre: balance y lista. Las cuentas se pueden seguir
 * ajustando después del viaje; cargar, editar y borrar se hace en la pantalla de
 * gastos, y al volver esta pestaña se actualiza sola.
 */
type Props = {
  viajeId: string
  /**
   * Cantidad de gastos cargados (null mientras carga o si falló). La pantalla la usa
   * para el botón de la barra: lápiz para editar, "+" si todavía no hay ninguno.
   */
  onCantidad?: (cantidad: number | null) => void
}

export function GastosCierrePanel({ viajeId, onCantidad }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { backendUserId } = useAuth()
  const miId = backendUserId || DEV_USER_ID || ''
  const [gastos, setGastos] = useState<GastoApi[]>([])
  const [balance, setBalance] = useState<BalanceGastosApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroGastos>('todos')

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
      onCantidad?.(lista.length)
    } catch (e) {
      onCantidad?.(null)
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los gastos.')
    } finally {
      setCargando(false)
    }
  }, [viajeId, onCantidad])

  // Al volver de la pantalla de gastos hay que traer lo que se cargó o corrigió ahí.
  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const visibles = useMemo(() => filtrarGastos(gastos, filtro, miId), [gastos, filtro, miId])

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
            En este viaje no se registró ningún gasto. Si quedó algo sin anotar, todavía podés
            cargarlo.
          </Text>
        </View>
      ) : null}

      {!error && gastos.length > 0 ? (
        <>
          <ResumenGastosCard gastos={gastos} miId={miId} theme={theme} />
          <BalanceCard balance={balance} miId={miId} theme={theme} />
        </>
      ) : null}

      {gastos.length > 1 ? (
        <FiltrosGastos gastos={gastos} miId={miId} filtro={filtro} onChange={setFiltro} />
      ) : null}

      {gastos.length > 0 && visibles.length === 0 ? (
        <Text style={[styles.sinCoincidencias, { color: theme.textMute }]}>
          Ningún gasto coincide con este filtro.
        </Text>
      ) : null}

      {visibles.map((g) => (
        <GastoFila key={g.id} gasto={g} miId={miId} theme={theme} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  lista: { padding: 16, gap: 10 },
  vacio: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  vacioTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  vacioTxt: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sinCoincidencias: { fontSize: 14, textAlign: 'center', marginTop: 16 },
})
