/**
 * Gravedad de un aviso del viaje: decide cómo suena y vibra la push (canal de
 * Android) y, en el frontend, el patrón de vibración con la app abierta
 * (espejo en `frontend/lib/haptics.ts`).
 *
 * - `critica`: hay una persona en riesgo (peligro, posible incidente, pedido de ayuda, accidente).
 * - `importante`: cambia lo que el grupo tiene que hacer (parada, desvío, atraso, combustible).
 * - `informativa`: solo avisa, no pide acción.
 */
export type GravedadAviso = 'critica' | 'importante' | 'informativa'

/** Canales de notificación de Android: los crea `frontend/hooks/usePushNotifications.ts`. */
export const CANAL_POR_GRAVEDAD: Record<GravedadAviso, string> = {
  critica: 'alertas-criticas',
  importante: 'viajes',
  informativa: 'avisos',
}

export function gravedadDeAlerta(tipo: string): GravedadAviso {
  if (tipo === 'peligro') return 'critica'
  if (tipo === 'informacion') return 'informativa'
  return 'importante'
}
