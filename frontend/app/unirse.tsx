import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { ejecutarUnionPorQr } from '@/lib/joinViajeQr'
import { Btn, useTheme } from '@/components/MeshUI'

export default function UnirseScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId?: string }>()
  const { backendUserId, backendSyncing } = useAuth()
  const theme = useTheme()
  const [mensaje, setMensaje] = useState('Procesando invitación…')
  // Con la unión fallida se saca el spinner y se ofrece salir de la pantalla.
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (backendSyncing) return
    if (!viajeId) {
      setMensaje('Enlace de invitación inválido.')
      setFallo(true)
      return
    }

    let cancelado = false

    ;(async () => {
      try {
        const userId = resolveBackendUserId(backendUserId)
        if (cancelado) return
        const unido = await ejecutarUnionPorQr(viajeId, userId)
        if (!unido && !cancelado) {
          setMensaje('No pudimos sumarte al viaje.')
          setFallo(true)
        }
      } catch {
        if (!cancelado) {
          setMensaje('No se pudo identificar tu usuario. Iniciá sesión e intentá de nuevo.')
          setFallo(true)
        }
      }
    })()

    return () => {
      cancelado = true
    }
  }, [viajeId, backendUserId, backendSyncing])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {!fallo && <ActivityIndicator color={theme.accent} size="large" />}
      <Text style={[styles.texto, { color: theme.textDim }]}>{mensaje}</Text>
      {fallo && (
        <Btn
          variant="primary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          Volver
        </Btn>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  texto: { 
    fontSize: 15, 
    textAlign: 'center',
    fontWeight: '600',
  },
})
