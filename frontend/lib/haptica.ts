import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/** Confirmación de una acción positiva (aceptar una invitación). En web no hace nada. */
export function vibrarExito() {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

/** Toque corto para acciones neutras (rechazar, descartar). En web no hace nada. */
export function vibrarSuave() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}
