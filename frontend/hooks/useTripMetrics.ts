import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { formatDistanceKm, formatElapsedHms, haversineDistanceM } from '@/lib/geo/haversine'
import { filtrosGpsPorActividad } from '@/lib/gpsFilters'
import { loadTripMetrics, saveTripMetrics } from '@/lib/tripMetricsStore'

type Options = {
  viajeId: string
  userId: string
  fechaInicioReal: string | null
  tipoActividad?: string
}

/** Cada cuánto bajamos el acumulado a disco. Un tick GPS llega cada 5 s. */
const PERSIST_INTERVAL_MS = 10000

/** Ventana sobre la que se promedia la velocidad "actual" (dos o tres ticks de 5 s). */
const VELOCIDAD_ACTUAL_VENTANA_MS = 15_000

export function useTripMetrics({ viajeId, userId, fechaInicioReal, tipoActividad = 'otro' }: Options) {
  const [elapsedLabel, setElapsedLabel] = useState('00:00:00')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [distanceM, setDistanceM] = useState(0)
  /** RN-065: velocidad reciente para el panel de entrenamiento. `null` sin datos frescos. */
  const [velocidadActualKmh, setVelocidadActualKmh] = useState<number | null>(null)
  const ventanaRef = useRef<{ ts: number; metros: number }[]>([])

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
      setElapsedSec(sec)
      // Si hace rato que no llega un tick con movimiento, la velocidad actual es 0.
      const ultimo = ventanaRef.current[ventanaRef.current.length - 1]
      if (ultimo && Date.now() - ultimo.ts > VELOCIDAD_ACTUAL_VENTANA_MS) {
        ventanaRef.current = []
        setVelocidadActualKmh(0)
      }
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
      (p: { userId: string; lat: number; lng: number; recordedAt?: string }) => {
        if (p.userId !== uid) return
        // Evita sumar contra un `prev` vacío mientras se hidrata desde disco.
        if (!hydratedRef.current) return

        const ahora = p.recordedAt ? new Date(p.recordedAt).getTime() : Date.now()
        const prev = prevRef.current
        if (prev) {
          const delta = haversineDistanceM(prev.lat, prev.lng, p.lat, p.lng)
          const f = filtrosGpsPorActividad(tipoActividad)
          if (delta > f.segmentoMinM && delta <= f.segmentoMaxM) {
            distanceRef.current += delta
            setDistanceM(distanceRef.current)
            ventanaRef.current.push({ ts: ahora, metros: delta })
          } else if (delta <= f.segmentoMinM) {
            ventanaRef.current.push({ ts: ahora, metros: 0 })
          }
          // Velocidad actual = metros de la ventana / tiempo de la ventana.
          const desde = ahora - VELOCIDAD_ACTUAL_VENTANA_MS
          ventanaRef.current = ventanaRef.current.filter((v) => v.ts >= desde)
          const v = ventanaRef.current
          if (v.length >= 2) {
            const seg = (v[v.length - 1]!.ts - v[0]!.ts) / 1000
            const metros = v.slice(1).reduce((acc, x) => acc + x.metros, 0)
            if (seg > 0) setVelocidadActualKmh((metros / seg) * 3.6)
          }
        }
        prevRef.current = { lat: p.lat, lng: p.lng }
      }
    )
    return () => sub.remove()
  }, [viajeId, userId, tipoActividad])

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

  const velocidadPromedioKmh = elapsedSec > 0 && distanceM > 0 ? (distanceM / elapsedSec) * 3.6 : null
  const paceMinKm = distanceM > 0 && elapsedSec > 0 ? (elapsedSec / 60) / (distanceM / 1000) : null

  return {
    elapsedLabel,
    distanceLabel: formatDistanceKm(distanceM),
    distanceM,
    velocidadActualKmh,
    velocidadPromedioKmh,
    paceMinKm,
  }
}
