import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { DeviceEventEmitter } from 'react-native'

import { enqueueGpsSample } from '@/lib/tracking/gpsQueue'

export const MESH_LOCATION_TASK = 'MESH_LOCATION_TASK_V1'

const K_VIAJE = 'mesh:tracking:viajeId'
const K_USER = 'mesh:tracking:userId'

TaskManager.defineTask(MESH_LOCATION_TASK, async ({ data, error }) => {
  if (error) return
  if (!data) return

  const { locations } = data as { locations: Location.LocationObject[] }
  const viajeId = await AsyncStorage.getItem(K_VIAJE)
  const userId = await AsyncStorage.getItem(K_USER)
  if (!viajeId || !userId) return

  for (const loc of locations) {
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
})

export async function setTrackingContext(viajeId: string, userId: string): Promise<void> {
  await AsyncStorage.multiSet([
    [K_VIAJE, viajeId],
    [K_USER, userId],
  ])
}

export async function clearTrackingContext(): Promise<void> {
  await AsyncStorage.multiRemove([K_VIAJE, K_USER])
}
