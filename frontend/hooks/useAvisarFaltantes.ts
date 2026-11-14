import { useCallback, useState } from 'react'

import { meshAlert } from '@/lib/meshAlert'
import { avisarFaltantes, type ViajeParticipanteApi } from '@/lib/viajesApi'

/**
 * RN-029e: los que dijeron que iban y todavía no están (confirmados sin
 * check-in). Antes de iniciar nadie hizo check-in, así que son todos los
 * confirmados. Es solo para mostrar el botón: el backend vuelve a calcularlo.
 */
export function contarFaltantes(participantes: ViajeParticipanteApi[], yoId: string | null): number {
  return participantes.filter(
    (m) =>
      m.usuario.id !== yoId && m.estado === 'confirmado' && m.check_in_at == null && !m.union_efectiva
  ).length
}

/**
 * RN-029e: push del líder a los que faltan. El backend valida el rol (RN-030)
 * y la espera de 2 minutos entre avisos (`429 AVISO_RECIENTE`).
 */
export function useAvisarFaltantes(viajeId: string | undefined, onNoFaltaNadie?: () => void) {
  const [avisando, setAvisando] = useState(false)

  const avisar = useCallback(async () => {
    if (!viajeId || avisando) return
    setAvisando(true)
    try {
      const r = await avisarFaltantes(viajeId)
      if (r.faltantes === 0) {
        meshAlert('No falta nadie', 'Todos los que confirmaron ya están en el viaje.')
        onNoFaltaNadie?.()
      } else if (r.avisados === 0) {
        meshAlert(
          'No se pudo avisar',
          'Los que faltan no tienen las notificaciones activadas en su teléfono.'
        )
      } else {
        meshAlert(
          'Aviso enviado',
          r.avisados === r.faltantes
            ? `Les avisamos a los ${r.avisados} que faltan.`
            : `Les avisamos a ${r.avisados} de los ${r.faltantes} que faltan. El resto no tiene las notificaciones activadas.`
        )
      }
    } catch (e: unknown) {
      meshAlert('No se envió el aviso', e instanceof Error ? e.message : 'Probá de nuevo.')
    } finally {
      setAvisando(false)
    }
  }, [viajeId, avisando, onNoFaltaNadie])

  return { avisando, avisar }
}
