import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { resolveBackendUserId } from '@/lib/apiClient'
import { ejecutarUnionPorQr } from '@/lib/joinViajeQr'

export default function UnirseScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId?: string }>()
  const { backendUserId, backendSyncing } = useAuth()
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
    <>
      <Stack.Screen options={{ title: 'Unirse al grupo' }} />
      <View style={styles.container}>
        <ActivityIndicator color="#4a9eff" size="large" />
        <Text style={styles.texto}>{mensaje}</Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  texto: { color: '#888', fontSize: 15, textAlign: 'center' },
})
