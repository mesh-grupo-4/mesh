import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCopilot } from 'react-native-copilot'
import { TopBar, useTheme } from '@/components/MeshUI'
import { PrivacidadViajePanel } from '@/components/PrivacidadViajePanel'
import { ScrollViewAyuda } from '@/components/ayuda/ScrollViewAyuda'

/**
 * RN-111/112: interruptor de compartir ubicación en este viaje y registro de
 * quiénes accedieron a la posición propia. El contenido vive en
 * `PrivacidadViajePanel`, que también usa la pestaña Configuración del viaje.
 */
export default function PrivacidadViajeScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ viajeId: string | string[] }>()
  const [claveRecarga, setClaveRecarga] = useState(0)

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        title="Privacidad"
        sub="Quién ve tu ubicación en este viaje"
        onBack={() => router.back()}
        onAyuda={() => start()}
      />

      <ScrollViewAyuda
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => setClaveRecarga((n) => n + 1)}
            tintColor={theme.accent}
          />
        }
      >
        {viajeId ? <PrivacidadViajePanel viajeId={viajeId} conAyuda claveRecarga={claveRecarga} /> : null}
      </ScrollViewAyuda>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
})
