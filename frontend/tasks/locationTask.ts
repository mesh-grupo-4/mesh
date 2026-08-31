import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { DeviceEventEmitter } from 'react-native'

import { enqueueGpsSample } from '@/lib/tracking/gpsQueue'

export const MESH_LOCATION_TASK = 'MESH_LOCATION_TASK_V1'

const K_VIAJE = 'mesh:tracking:viajeId'
const K_USER = 'mesh:tracking:userId'
const K_ACTIVIDAD = 'mesh:tracking:tipoActividad'

async function aceptarMuestraEnTask(
  lat: number,
  lng: number,
  accuracy: number | null,
  ts: number,
  tipoActividad: string,
  ultima: { lat: number; lng: number; ts: number } | null
): Promise<{ ok: boolean; ultima: { lat: number; lng: number; ts: number } | null }> {
  const { filtrosGpsPorActividad, velocidadImplicitaKmh } = await import('@/lib/gpsFilters')
  const f = filtrosGpsPorActividad(tipoActividad)
  if (accuracy != null && accuracy > f.precisionMaxM) {
    return { ok: false, ultima }
  }
  if (ultima) {
    const seg = (ts - ultima.ts) / 1000
    if (seg > 0 && seg <= 120) {
      const vel = velocidadImplicitaKmh(ultima.lat, ultima.lng, lat, lng, seg)
      if (vel != null && vel > f.velocidadMaxKmh) {
        return { ok: false, ultima }
      }
    }
  }
  return { ok: true, ultima: { lat, lng, ts } }
}

let ultimaMuestraTask: { lat: number; lng: number; ts: number } | null = null

TaskManager.defineTask(MESH_LOCATION_TASK, async ({ data, error }) => {
  if (error) return
  if (!data) return

  const { locations } = data as { locations: Location.LocationObject[] }
  const pairs = await AsyncStorage.multiGet([K_VIAJE, K_USER, K_ACTIVIDAD])
  const viajeId = pairs.find(([k]) => k === K_VIAJE)?.[1]
  const userId = pairs.find(([k]) => k === K_USER)?.[1]
  const tipoActividad = pairs.find(([k]) => k === K_ACTIVIDAD)?.[1] ?? 'otro'
  if (!viajeId || !userId) return

  for (const loc of locations) {
    const { latitude, longitude, accuracy } = loc.coords
    const ts = loc.timestamp > 0 ? loc.timestamp : Date.now()
    const check = await aceptarMuestraEnTask(
      latitude,
      longitude,
      accuracy ?? null,
      ts,
      tipoActividad,
      ultimaMuestraTask
    )
    if (!check.ok) continue
    ultimaMuestraTask = check.ultima

    const queueId = enqueueGpsSample({
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
      queueId,
    })
  }
})

export async function setTrackingContext(
  viajeId: string,
  userId: string,
  tipoActividad = 'otro'
): Promise<void> {
  ultimaMuestraTask = null
  await AsyncStorage.multiSet([
    [K_VIAJE, viajeId],
    [K_USER, userId],
    [K_ACTIVIDAD, tipoActividad],
  ])
}

export async function getTrackingContext(): Promise<{ viajeId: string; userId: string } | null> {
  const pairs = await AsyncStorage.multiGet([K_VIAJE, K_USER])
  const viajeId = pairs.find(([k]) => k === K_VIAJE)?.[1]
  const userId = pairs.find(([k]) => k === K_USER)?.[1]
  if (!viajeId || !userId) return null
  return { viajeId, userId }
}

export async function clearTrackingContext(): Promise<void> {
  ultimaMuestraTask = null
  await AsyncStorage.multiRemove([K_VIAJE, K_USER, K_ACTIVIDAD])
}
