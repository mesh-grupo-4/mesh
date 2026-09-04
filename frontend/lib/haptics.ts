import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { uiConfigPorActividad } from './activityUi'
import type { TipoActividadApi } from './viajesApi'

export type NivelHaptica = 'info' | 'exito' | 'alerta'

/** Dispara vibración solo en actividades que la priorizan (RN-052: trekking/running). */
export function feedbackEvento(tipoActividad: TipoActividadApi, nivel: NivelHaptica = 'info'): void {
  if (Platform.OS === 'web') return
  if (!uiConfigPorActividad(tipoActividad).hapticaPrioritaria) return

  switch (nivel) {
    case 'exito':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      break
    case 'alerta':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      break
    default:
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }
}

/** Vibra una sola vez cuando `activo` pasa de false a true (evita repetir mientras el evento sigue vigente). */
export function useHapticaAlEntrar(
  activo: boolean,
  tipoActividad: TipoActividadApi,
  nivel: NivelHaptica = 'info'
): void {
  const previoRef = useRef(false)

  useEffect(() => {
    if (activo && !previoRef.current) feedbackEvento(tipoActividad, nivel)
    previoRef.current = activo
  }, [activo, tipoActividad, nivel])
}
