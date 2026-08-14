import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Persistencia de la distancia recorrida por viaje (AC3 de E04).
 * Sin esto el contador se reinicia cada vez que el usuario sale y vuelve
 * a la pantalla de monitoreo.
 */
export type TripMetricsSnapshot = {
  distanceM: number
  lastLat: number | null
  lastLng: number | null
}

const EMPTY: TripMetricsSnapshot = { distanceM: 0, lastLat: null, lastLng: null }

function keyFor(viajeId: string, userId: string): string {
  return `mesh:metrics:${viajeId}:${userId}`
}

export async function loadTripMetrics(
  viajeId: string,
  userId: string
): Promise<TripMetricsSnapshot> {
  if (!viajeId || !userId) return EMPTY
  try {
    const raw = await AsyncStorage.getItem(keyFor(viajeId, userId))
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<TripMetricsSnapshot>
    const distanceM = Number(parsed.distanceM)
    return {
      distanceM: Number.isFinite(distanceM) && distanceM >= 0 ? distanceM : 0,
      lastLat: typeof parsed.lastLat === 'number' ? parsed.lastLat : null,
      lastLng: typeof parsed.lastLng === 'number' ? parsed.lastLng : null,
    }
  } catch {
    return EMPTY
  }
}

export async function saveTripMetrics(
  viajeId: string,
  userId: string,
  snapshot: TripMetricsSnapshot
): Promise<void> {
  if (!viajeId || !userId) return
  try {
    await AsyncStorage.setItem(keyFor(viajeId, userId), JSON.stringify(snapshot))
  } catch {
    /* almacenamiento lleno o no disponible: la métrica sigue viva en memoria */
  }
}

export async function clearTripMetrics(viajeId: string, userId: string): Promise<void> {
  if (!viajeId || !userId) return
  try {
    await AsyncStorage.removeItem(keyFor(viajeId, userId))
  } catch {
    /* no bloquea el fin del viaje */
  }
}
