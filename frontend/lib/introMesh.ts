import { isRunningInExpoGo } from 'expo'
import * as Location from 'expo-location'
import { AccessibilityInfo, Linking, Platform } from 'react-native'

import { esLinkDeMesh } from '@/lib/inviteLinks'
import { MESH_LOCATION_TASK } from '@/tasks/locationTask'

/** Tope para decidir: el splash nativo espera esta respuesta. */
const TOPE_DECISION_MS = 800

let yaDecidida = false

async function pideMenosMovimiento(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled()
  } catch {
    return false
  }
}

async function hayViajeEnCurso(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
  } catch {
    // En Expo Go la tarea de segundo plano no existe.
    return false
  }
}

async function entroPorLink(): Promise<boolean> {
  try {
    const url = await Linking.getInitialURL()
    return !!url && esLinkDeMesh(url)
  } catch {
    return false
  }
}

async function entroPorNotificacion(): Promise<boolean> {
  if (isRunningInExpoGo()) return false
  try {
    const Notifications = await import('expo-notifications')
    return Notifications.getLastNotificationResponse() != null
  } catch {
    return false
  }
}

/**
 * La intro va solo al abrir la app desde cero y sin apuro: nadie espera 3 segundos
 * para ver el mapa en medio de un viaje ni al entrar desde un link o una notificación.
 */
export function debeMostrarIntro(): Promise<boolean> {
  if (yaDecidida || Platform.OS === 'web') return Promise.resolve(false)
  yaDecidida = true

  const decision = Promise.all([
    pideMenosMovimiento(),
    hayViajeEnCurso(),
    entroPorLink(),
    entroPorNotificacion(),
  ]).then((motivos) => !motivos.some(Boolean))

  const tope = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TOPE_DECISION_MS))
  return Promise.race([decision, tope])
}
