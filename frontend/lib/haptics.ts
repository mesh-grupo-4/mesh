import { useEffect, useRef } from 'react'
import { Platform, Vibration } from 'react-native'

import { uiConfigPorActividad } from './activityUi'
import { vibracionAvisosActiva } from './vibracionPrefs'
import type { TipoActividadApi } from './viajesApi'

/**
 * Gravedad de un evento del viaje (espejo de `backend/src/lib/gravedadAlerta.ts`),
 * más `exito` para los eventos buenos (llegada).
 *
 * - `critica`: hay una persona en riesgo. Tiene que sentirse con guantes y con el motor en marcha.
 * - `importante`: cambia lo que el grupo tiene que hacer (parada, desvío, atraso).
 * - `informativa`: solo avisa.
 */
export type NivelHaptica = 'informativa' | 'importante' | 'critica' | 'exito'

/**
 * Patrones `[espera, vibra, espera, vibra, …]` en ms. Se distinguen por cantidad y
 * largo de los pulsos, no por intensidad: es lo único que se reconoce sin mirar.
 * En iOS cada pulso dura lo que fija el sistema; se conserva la cantidad.
 */
const PATRON: Record<NivelHaptica, number[]> = {
  informativa: [0, 200],
  exito: [0, 120, 100, 120],
  importante: [0, 350, 150, 350],
  critica: [0, 700, 200, 700, 200, 700],
}

const PAUSA_REFUERZO_MS = 500
/** Cada cuánto se repite un evento crítico que espera respuesta. */
const REPETICION_CRITICA_MS = 5_000

/**
 * Vibra según la gravedad del evento, en todas las actividades. Lo crítico vibra
 * siempre; el resto respeta la preferencia del dispositivo (`vibracionPrefs.ts`).
 */
export function feedbackEvento(tipoActividad: TipoActividadApi, nivel: NivelHaptica = 'informativa'): void {
  if (Platform.OS === 'web') return
  if (nivel !== 'critica' && !vibracionAvisosActiva()) return

  const patron = PATRON[nivel]
  // Running/trekking no miran la pantalla (RN-052): lo que pide atención se repite.
  const reforzar =
    uiConfigPorActividad(tipoActividad).hapticaPrioritaria &&
    (nivel === 'importante' || nivel === 'critica')

  Vibration.vibrate(reforzar ? [...patron, PAUSA_REFUERZO_MS, ...patron.slice(1)] : patron)
}

/**
 * Vibra cada vez que `clave` pasa a identificar un evento nuevo (`null` = no hay
 * evento). Mientras el mismo evento sigue vigente no repite; si entra otro
 * distinto encima —otra alerta con otro id— vuelve a vibrar.
 */
export function useHapticaAlEntrar(
  clave: string | null,
  tipoActividad: TipoActividadApi,
  nivel: NivelHaptica = 'informativa'
): void {
  const previaRef = useRef<string | null>(null)

  useEffect(() => {
    if (clave && clave !== previaRef.current) feedbackEvento(tipoActividad, nivel)
    previaRef.current = clave
  }, [clave, tipoActividad, nivel])
}

/**
 * Evento crítico que espera una respuesta de la persona (el "¿estás bien?" de un
 * posible incidente): vibra al entrar y se repite cada 5 s hasta que `activo`
 * vuelve a false. Con el teléfono en el bolsillo o en el soporte, un solo aviso
 * pasa de largo.
 */
export function useHapticaCriticaRepetida(activo: boolean): void {
  useEffect(() => {
    if (!activo || Platform.OS === 'web') return
    Vibration.vibrate(PATRON.critica)
    const intervalo = setInterval(() => Vibration.vibrate(PATRON.critica), REPETICION_CRITICA_MS)
    return () => {
      clearInterval(intervalo)
      Vibration.cancel()
    }
  }, [activo])
}
