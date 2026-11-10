import { router } from 'expo-router'
import { meshAlert } from '@/lib/meshAlert'

import { MeshApiError } from '@/lib/apiClient'
import { unirseViajePorCodigo, unirseViajePorQr } from '@/lib/viajesApi'
import { CODIGO_EXPIRED_MESSAGE, QR_EXPIRED_MESSAGE } from '@/lib/inviteLinks'

function abrirViaje(viajeId: string) {
  router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId } })
}

export async function ejecutarUnionPorQr(viajeId: string, userId: string): Promise<boolean> {
  try {
    const result = await unirseViajePorQr(viajeId, userId)
    abrirViaje(result.viajeId)
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

/** RN-015: une por código y abre el viaje. Devuelve el problema a mostrar, o null si salió bien. */
export async function ejecutarUnionPorCodigo(codigo: string): Promise<string | null> {
  try {
    const result = await unirseViajePorCodigo(codigo)
    abrirViaje(result.viajeId)
    return null
  } catch (e: unknown) {
    if (e instanceof MeshApiError && e.status === 410) return CODIGO_EXPIRED_MESSAGE
    return e instanceof Error ? e.message : 'No se pudo unir al viaje.'
  }
}
