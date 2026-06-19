import { useEffect, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { formatDistanceKm, formatElapsedHms, haversineDistanceM } from '@/lib/geo/haversine'

type Options = {
  userId: string
  fechaInicioReal: string | null
}

export function useTripMetrics({ userId, fechaInicioReal }: Options) {
  const [elapsedLabel, setElapsedLabel] = useState('00:00:00')
  const [distanceM, setDistanceM] = useState(0)

  useEffect(() => {
    if (!fechaInicioReal) {
      setElapsedLabel('00:00:00')
      return
    }
    const startMs = new Date(fechaInicioReal).getTime()
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      setElapsedLabel(formatElapsedHms(sec))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fechaInicioReal])

  useEffect(() => {
    if (!userId.trim()) return
    let prev: { lat: number; lng: number } | null = null

    const sub = DeviceEventEmitter.addListener(
      'mesh:location_tick',
      (p: { userId: string; lat: number; lng: number }) => {
        if (p.userId !== userId) return
        if (prev) {
          const delta = haversineDistanceM(prev.lat, prev.lng, p.lat, p.lng)
          if (delta > 0 && delta < 500) {
            setDistanceM((d) => d + delta)
          }
        }
        prev = { lat: p.lat, lng: p.lng }
      }
    )
    return () => sub.remove()
  }, [userId])

  return {
    elapsedLabel,
    distanceLabel: formatDistanceKm(distanceM),
  }
}
