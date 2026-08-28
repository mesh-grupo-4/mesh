import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Location from 'expo-location'
import { DeviceEventEmitter, Platform } from 'react-native'

import { filtrosGpsPorActividad, velocidadImplicitaKmh } from '@/lib/gpsFilters'
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

/**
 * Expo Go no puede correr tareas de ubicación en segundo plano (`expo-task-manager`):
 * al registrarlas crashea el runtime nativo ("lateinit property launcher has not been
 * initialized"). En ese entorno hacemos tracking solo en primer plano. El segundo plano
 * real requiere un development build / EAS build.
 */
const EN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

let foregroundWatch: Location.LocationSubscription | null = null
let tipoActividadActual = 'otro'
let ultimaMuestra: { lat: number; lng: number; ts: number } | null = null

function aceptarMuestra(
  lat: number,
  lng: number,
  accuracy: number | null | undefined,
  ts: number
): boolean {
  const f = filtrosGpsPorActividad(tipoActividadActual)
  if (accuracy != null && accuracy > f.precisionMaxM) return false

  const prev = ultimaMuestra
  if (prev) {
    const seg = (ts - prev.ts) / 1000
    if (seg > 0 && seg <= 120) {
      const vel = velocidadImplicitaKmh(prev.lat, prev.lng, lat, lng, seg)
      if (vel != null && vel > f.velocidadMaxKmh) return false
    }
  }

  ultimaMuestra = { lat, lng, ts }
  return true
}

function emitLocationSample(viajeId: string, userId: string, loc: Location.LocationObject): void {
  const { latitude, longitude, accuracy } = loc.coords
  const ts = loc.timestamp > 0 ? loc.timestamp : Date.now()
  if (!aceptarMuestra(latitude, longitude, accuracy, ts)) return

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
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 4,
    },
    (loc) => emitLocationSample(viajeId, userId, loc)
  )
}

export async function solicitarPermisosUbicacion(): Promise<PermisoResultado> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    return { foreground: false, background: false }
  }
  if (Platform.OS === 'web' || EN_EXPO_GO) {
    return { foreground: true, background: false }
  }
  const bg = await Location.requestBackgroundPermissionsAsync()
  return { foreground: true, background: bg.status === 'granted' }
}

export async function iniciarTrackingViaje(
  viajeId: string,
  userId: string,
  tipoActividad = 'otro'
): Promise<void> {
  if (Platform.OS === 'web') return
  tipoActividadActual = tipoActividad
  ultimaMuestra = null
  await setTrackingContext(viajeId, userId, tipoActividad)
  const fg = await Location.getForegroundPermissionsAsync()
  if (fg.status !== 'granted') return

  if (EN_EXPO_GO) {
    await stopBackgroundTask()
    await startForegroundWatch(viajeId, userId)
    return
  }

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
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 4,
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
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(MESH_LOCATION_TASK)
    if (running) {
      await Location.stopLocationUpdatesAsync(MESH_LOCATION_TASK)
    }
  } catch {
    // En Expo Go la tarea de segundo plano no existe; nada que detener.
  }
}

export async function detenerTrackingViaje(): Promise<void> {
  if (Platform.OS === 'web') return
  await stopForegroundWatch()
  await stopBackgroundTask()
  ultimaMuestra = null
  // Ojo: NO se borra el acumulado de distancia acá. La pantalla de resumen lo usa
  // como fallback cuando el backend no responde, y la limpia ella cuando ya no
  // hace falta. Ver `app/viaje/[viajeId]/resumen.tsx`.
  await clearTrackingContext()
}
