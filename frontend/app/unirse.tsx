import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { ejecutarUnionPorQr } from '@/lib/joinViajeQr'
import { useTheme } from '@/components/MeshUI'

export default function UnirseScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId?: string }>()
  const { backendUserId, backendSyncing } = useAuth()
  const theme = useTheme()
  const [mensaje, setMensaje] = useState('Procesando invitación…')

  useEffect(() => {
    if (backendSyncing) return
    if (!viajeId) {
      setMensaje('Enlace de invitación inválido.')
      return
    }

    let cancelado = false

    ;(async () => {
      try {
        const userId = resolveBackendUserId(backendUserId)
        if (cancelado) return
        await ejecutarUnionPorQr(viajeId, userId)
      } catch {
        if (!cancelado) {
          setMensaje('No se pudo identificar tu usuario. Iniciá sesión e intentá de nuevo.')
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
      <ActivityIndicator color={theme.accent} size="large" />
      <Text style={[styles.texto, { color: theme.textDim }]}>{mensaje}</Text>
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
