import { isSupabaseConfigured } from '@/lib/supabase'
import { emitTripStartedWithRetry } from '@/lib/tripBroadcast'
import { solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import { iniciarViajeEnBackend } from '@/lib/viajesApi'

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
