import { router } from 'expo-router'
import { meshAlert } from '@/lib/meshAlert'

import { MeshApiError } from '@/lib/apiClient'
import { unirseViajePorQr } from '@/lib/viajesApi'
import { QR_EXPIRED_MESSAGE } from '@/lib/inviteLinks'

export async function ejecutarUnionPorQr(viajeId: string, userId: string): Promise<boolean> {
  try {
    const result = await unirseViajePorQr(viajeId, userId)
    router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId: result.viajeId } })
    meshAlert(
      '¡Listo!',
      result.yaEraParticipante
        ? 'Ya formabas parte de este viaje.'
        : 'Te uniste al viaje correctamente.'
    )
    return true
  } catch (e: unknown) {
    if (e instanceof MeshApiError && e.status === 410) {
      meshAlert('QR expirado', QR_EXPIRED_MESSAGE)
      return false
    }
    const msg = e instanceof Error ? e.message : 'No se pudo unir al viaje.'
    meshAlert('Error', msg)
    return false
  }
}
