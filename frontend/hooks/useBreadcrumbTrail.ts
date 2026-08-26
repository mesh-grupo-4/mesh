import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { haversineDistanceM } from '@/lib/geo/haversine'
import { filtrosGpsPorActividad } from '@/lib/gpsFilters'

type Options = {
  viajeId: string
  userId: string
  tipoActividad?: string
  habilitado?: boolean
}

/** Acumula la traza GPS propia para dibujar el breadcrumb en el mapa en vivo. */
export function useBreadcrumbTrail({
  viajeId,
  userId,
  tipoActividad = 'otro',
  habilitado = true,
}: Options) {
  const [puntos, setPuntos] = useState<[number, number][]>([])
  const ultimoRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!habilitado) return
    setPuntos([])
    ultimoRef.current = null
  }, [viajeId, userId, habilitado])

  useEffect(() => {
    if (!habilitado || !viajeId || !userId.trim()) return

    const uid = userId.trim()
    const sub = DeviceEventEmitter.addListener(
      'mesh:location_tick',
      (p: { viajeId: string; userId: string; lat: number; lng: number }) => {
        if (p.viajeId !== viajeId || p.userId !== uid) return

        const prev = ultimoRef.current
        const f = filtrosGpsPorActividad(tipoActividad)
        if (prev) {
          const delta = haversineDistanceM(prev.lat, prev.lng, p.lat, p.lng)
          if (delta < f.segmentoMinM || delta > f.segmentoMaxM) return
        }

        ultimoRef.current = { lat: p.lat, lng: p.lng }
        setPuntos((prevPts) => {
          const ult = prevPts[prevPts.length - 1]
          if (ult && ult[0] === p.lat && ult[1] === p.lng) return prevPts
          return [...prevPts, [p.lat, p.lng]]
        })
      }
    )

    return () => sub.remove()
  }, [viajeId, userId, tipoActividad, habilitado])

  return puntos
}
