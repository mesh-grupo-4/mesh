import { haversineDistanceM } from '@/lib/geo/haversine'

export type RouteStop = {
  lat: number
  lng: number
  name: string
  type: 'ORIGIN' | 'STOP' | 'DESTINATION'
}

const VISIT_THRESHOLD_M = 100

export type NextStopInfo = {
  stop: RouteStop
  distanceM: number
  etaSec: number
}

/** Próximo waypoint no alcanzado según orden de la ruta. */
export function calcNextStop(
  lat: number,
  lng: number,
  stops: RouteStop[],
  speedKmh: number
): NextStopInfo | null {
  if (stops.length === 0 || speedKmh <= 0) return null

  for (const stop of stops) {
    const distanceM = haversineDistanceM(lat, lng, stop.lat, stop.lng)
    if (distanceM > VISIT_THRESHOLD_M) {
      const etaSec = (distanceM / 1000 / speedKmh) * 3600
      return { stop, distanceM, etaSec }
    }
  }

  const last = stops[stops.length - 1]!
  const distanceM = haversineDistanceM(lat, lng, last.lat, last.lng)
  return {
    stop: last,
    distanceM,
    etaSec: (distanceM / 1000 / speedKmh) * 3600,
  }
}

export function formatEtaLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '< 1 min'
  const totalMin = Math.max(1, Math.round(seconds / 60))
  if (totalMin < 60) return `~${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`
}

export function formatDistanceShort(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
