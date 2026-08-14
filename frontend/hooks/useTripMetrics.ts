import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { formatDistanceKm, formatElapsedHms, haversineDistanceM } from '@/lib/geo/haversine'
import { loadTripMetrics, saveTripMetrics } from '@/lib/tripMetricsStore'

type Options = {
  viajeId: string
  userId: string
  fechaInicioReal: string | null
}

/** Cada cuánto bajamos el acumulado a disco. Un tick GPS llega cada 5 s. */
const PERSIST_INTERVAL_MS = 10000

export function useTripMetrics({ viajeId, userId, fechaInicioReal }: Options) {
  const [elapsedLabel, setElapsedLabel] = useState('00:00:00')
  const [distanceM, setDistanceM] = useState(0)

  // Espejos para poder persistir sin re-suscribir el listener en cada tick.
  const distanceRef = useRef(0)
  const prevRef = useRef<{ lat: number; lng: number } | null>(null)
  const hydratedRef = useRef(false)

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

  // Hidrata el acumulado guardado antes de empezar a sumar (AC3: distancia
  // desde el punto de partida, no desde que se montó la pantalla).
  useEffect(() => {
    let cancelled = false
    hydratedRef.current = false
    distanceRef.current = 0
    prevRef.current = null
    setDistanceM(0)

    void (async () => {
      const snap = await loadTripMetrics(viajeId, userId.trim())
      if (cancelled) return
      distanceRef.current = snap.distanceM
      prevRef.current =
        snap.lastLat != null && snap.lastLng != null
          ? { lat: snap.lastLat, lng: snap.lastLng }
          : null
      setDistanceM(snap.distanceM)
      hydratedRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [viajeId, userId])

  useEffect(() => {
    const uid = userId.trim()
    if (!uid || !viajeId) return

    const sub = DeviceEventEmitter.addListener(
      'mesh:location_tick',
      (p: { userId: string; lat: number; lng: number }) => {
        if (p.userId !== uid) return
        // Evita sumar contra un `prev` vacío mientras se hidrata desde disco.
        if (!hydratedRef.current) return

        const prev = prevRef.current
        if (prev) {
          const delta = haversineDistanceM(prev.lat, prev.lng, p.lat, p.lng)
          if (delta > 0 && delta < 500) {
            distanceRef.current += delta
            setDistanceM(distanceRef.current)
          }
        }
        prevRef.current = { lat: p.lat, lng: p.lng }
      }
    )
    return () => sub.remove()
  }, [viajeId, userId])

  // Persiste con throttle y también al desmontar, para no castigar AsyncStorage
  // con una escritura cada 5 segundos.
  useEffect(() => {
    const uid = userId.trim()
    if (!uid || !viajeId) return

    const persist = () => {
      if (!hydratedRef.current) return
      const prev = prevRef.current
      void saveTripMetrics(viajeId, uid, {
        distanceM: distanceRef.current,
        lastLat: prev?.lat ?? null,
        lastLng: prev?.lng ?? null,
      })
    }

    const id = setInterval(persist, PERSIST_INTERVAL_MS)
    return () => {
      clearInterval(id)
      persist()
    }
  }, [viajeId, userId])

  return {
    elapsedLabel,
    distanceLabel: formatDistanceKm(distanceM),
  }
}
