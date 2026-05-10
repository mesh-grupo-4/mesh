import * as Location from 'expo-location'
import { Platform } from 'react-native'

import {
  clearTrackingContext,
  MESH_LOCATION_TASK,
  setTrackingContext,
} from '@/tasks/locationTask'

export type PermisoResultado = {
  foreground: boolean
  background: boolean
}

export async function solicitarPermisosUbicacion(): Promise<PermisoResultado> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    return { foreground: false, background: false }
  }
  if (Platform.OS === 'web') {
    return { foreground: true, background: false }
  }
  const bg = await Location.requestBackgroundPermissionsAsync()
  return { foreground: true, background: bg.status === 'granted' }
}

export async function iniciarTrackingViaje(viajeId: string, userId: string): Promise<void> {
  if (Platform.OS === 'web') return
  await setTrackingContext(viajeId, userId)
  const fg = await Location.getForegroundPermissionsAsync()
  if (fg.status !== 'granted') return

  const running = await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(MESH_LOCATION_TASK)
  }

  await Location.startLocationUpdatesAsync(MESH_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'La app está compartiendo tu ubicación',
      notificationBody: 'Mesh está transmitiendo tu posición al grupo.',
      notificationColor: '#15803d',
    },
  })
}

export async function detenerTrackingViaje(): Promise<void> {
  if (Platform.OS === 'web') return
  const running = await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(MESH_LOCATION_TASK)
  }
  await clearTrackingContext()
}
