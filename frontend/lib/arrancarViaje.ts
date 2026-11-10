import { MeshApiError } from '@/lib/apiClient'
import { meshAlert } from '@/lib/meshAlert'
import { isSupabaseConfigured } from '@/lib/supabase'
import { emitTripStartedWithRetry } from '@/lib/tripBroadcast'
import { solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import { iniciarViajeEnBackend } from '@/lib/viajesApi'

/**
 * RN-030c: si el inicio falló porque la persona ya está en otro viaje en curso,
 * avisa y ofrece ir a ese viaje. Devuelve `true` si el error era ese.
 */
export function avisarSiOtroViajeEnCurso(
  error: unknown,
  irAlViaje: (viajeId: string) => void
): boolean {
  if (!(error instanceof MeshApiError) || error.code !== 'OTRO_VIAJE_EN_CURSO') return false
  const { viajeEnCursoId } = error
  meshAlert(
    'Ya tenés un viaje en curso',
    error.message,
    viajeEnCursoId
      ? [
          { text: 'Cerrar', style: 'cancel' },
          { text: 'Ir al viaje en curso', onPress: () => irAlViaje(viajeEnCursoId) },
        ]
      : undefined
  )
  return true
}

/**
 * Inicia un viaje planificado: pide permisos de ubicación (y registra el
 * consentimiento, RN-110), hace la transición en el backend (RN-030, solo el
 * líder) y avisa por broadcast. El socket y el tracking los arranca `live.tsx`.
 *
 * Mismo flujo que el botón "Iniciar viaje" del detalle del viaje.
 */
export async function arrancarViaje(
  viajeId: string,
  userId: string,
  nombre: string | null
): Promise<{ ubicacionBloqueada: boolean }> {
  const perm = await solicitarPermisosUbicacion()
  const actualizado = await iniciarViajeEnBackend(viajeId, userId)

  if (isSupabaseConfigured()) {
    void emitTripStartedWithRetry(viajeId, {
      viajeId,
      nombre: actualizado.nombre ?? nombre,
      estado: 'en_curso',
      fechaInicioReal: actualizado.fecha_inicio_real ?? new Date().toISOString(),
      iniciadoPor: userId,
    }).catch((e) => console.warn('Broadcast TRIP_STARTED falló:', e))
  }

  return { ubicacionBloqueada: !perm.foreground }
}
