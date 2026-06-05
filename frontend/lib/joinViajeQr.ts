import { Alert } from 'react-native'
import { router } from 'expo-router'

import { MeshApiError } from '@/lib/apiClient'
import { unirseViajePorQr } from '@/lib/gruposApi'
import { QR_EXPIRED_MESSAGE } from '@/lib/inviteLinks'

export async function ejecutarUnionPorQr(viajeId: string, userId: string): Promise<boolean> {
  try {
    const result = await unirseViajePorQr(viajeId, userId)
    router.replace(`/grupo/${result.grupoId}`)
    Alert.alert(
      '¡Listo!',
      result.yaEraMiembro
        ? 'Ya formabas parte de este grupo.'
        : 'Te uniste al grupo correctamente.'
    )
    return true
  } catch (e: unknown) {
    if (e instanceof MeshApiError && e.status === 410) {
      Alert.alert('QR expirado', QR_EXPIRED_MESSAGE)
      return false
    }
    const msg = e instanceof Error ? e.message : 'No se pudo unir al grupo.'
    Alert.alert('Error', msg)
    return false
  }
}
