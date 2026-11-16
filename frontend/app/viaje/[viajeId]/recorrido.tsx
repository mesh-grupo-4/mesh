import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'

import { RecorridoMapView } from '@/components/RecorridoMapView'
import { TopBar, useTheme } from '@/components/MeshUI'
import { obtenerRecorrido } from '@/lib/viajesApi'

/** US2: recorrido realmente hecho en un viaje finalizado, a pantalla completa. */
export default function RecorridoScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  const theme = useTheme()
  const [segmentos, setSegmentos] = useState<[number, number][][]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!viajeId) return
    let cancelado = false
    setCargando(true)
    obtenerRecorrido(viajeId)
      .then((r) => {
        if (!cancelado) setSegmentos(r.segmentos)
      })
      .catch(() => {
        // Sin traza o sin red: el mapa muestra su estado vacío.
        if (!cancelado) setSegmentos([])
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [viajeId])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Recorrido" onBack={() => router.back()} bordered={false} />
      <RecorridoMapView segmentos={segmentos} cargando={cargando} completo />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
