import * as Location from 'expo-location'
import { DeviceEventEmitter, Platform } from 'react-native'

import { enqueueGpsSample } from '@/lib/tracking/gpsQueue'
import {
  clearTrackingContext,
  MESH_LOCATION_TASK,
  setTrackingContext,
} from '@/tasks/locationTask'

export type PermisoResultado = {
  foreground: boolean
  background: boolean
}

let foregroundWatch: Location.LocationSubscription | null = null

function emitLocationSample(viajeId: string, userId: string, loc: Location.LocationObject): void {
  const { latitude, longitude, accuracy } = loc.coords
  const ts = loc.timestamp > 0 ? loc.timestamp : Date.now()
  enqueueGpsSample({
    viajeId,
    userId,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? null,
    ts,
  })
  DeviceEventEmitter.emit('mesh:location_tick', {
    viajeId,
    userId,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? undefined,
    recordedAt: new Date(ts).toISOString(),
  })
}

async function stopForegroundWatch(): Promise<void> {
  if (foregroundWatch) {
    foregroundWatch.remove()
    foregroundWatch = null
  }
}

async function startForegroundWatch(viajeId: string, userId: string): Promise<void> {
  await stopForegroundWatch()
  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 0,
    },
    (loc) => emitLocationSample(viajeId, userId, loc)
  )
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

  const bg = await Location.getBackgroundPermissionsAsync()
  const useBackgroundTask = Platform.OS === 'android' || bg.status === 'granted'

  if (!useBackgroundTask && Platform.OS === 'ios') {
    await stopBackgroundTask()
    await startForegroundWatch(viajeId, userId)
    return
  }

  await stopForegroundWatch()

  const running = await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(MESH_LOCATION_TASK)
  }

  try {
    await Location.startLocationUpdatesAsync(MESH_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      ...(Platform.OS === 'android'
        ? {
            foregroundService: {
              notificationTitle: 'La app está compartiendo tu ubicación',
              notificationBody: 'Mesh está transmitiendo tu posición al grupo.',
              notificationColor: '#15803d',
            },
          }
        : {}),
    })
  } catch (e) {
    if (Platform.OS === 'ios') {
      console.warn('Background GPS no disponible en iOS, usando watch en primer plano:', e)
      await startForegroundWatch(viajeId, userId)
      return
    }
    throw e
  }
}

async function stopBackgroundTask(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
  if (running) {
    await Location.stopLocationUpdatesAsync(MESH_LOCATION_TASK)
  }
}

export async function detenerTrackingViaje(): Promise<void> {
  if (Platform.OS === 'web') return
  await stopForegroundWatch()
  await stopBackgroundTask()
  await clearTrackingContext()
}
