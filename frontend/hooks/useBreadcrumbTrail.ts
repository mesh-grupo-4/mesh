import { useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { haversineDistanceM } from '@/lib/geo/haversine'
import { filtrosGpsPorActividad, SEGMENTO_MAX_SEG } from '@/lib/gpsFilters'

type Options = {
  viajeId: string
  userId: string
  tipoActividad?: string
  habilitado?: boolean
}

type LocationTick = {
  viajeId: string
  userId: string
  lat: number
  lng: number
  recordedAt?: string
}

/**
 * Acumula la traza GPS propia para dibujar el breadcrumb en el mapa en vivo,
 * cortada en varios segmentos (no una sola polilínea) cuando hay un salto de
 * distancia o un hueco temporal grande — evita dibujar una línea recta
 * atravesando un tramo sin señal.
 */
export function useBreadcrumbTrail({
  viajeId,
  userId,
  tipoActividad = 'otro',
  habilitado = true,
}: Options) {
  const [segmentos, setSegmentos] = useState<[number, number][][]>([])
  const ultimoRef = useRef<{ lat: number; lng: number; ts: number } | null>(null)

  useEffect(() => {
    if (!habilitado) return
    setSegmentos([])
    ultimoRef.current = null
  }, [viajeId, userId, habilitado])

  useEffect(() => {
    if (!habilitado || !viajeId || !userId.trim()) return

    const uid = userId.trim()
    const sub = DeviceEventEmitter.addListener('mesh:location_tick', (p: LocationTick) => {
      if (p.viajeId !== viajeId || p.userId !== uid) return

      const ts = p.recordedAt ? new Date(p.recordedAt).getTime() : Date.now()
      const prev = ultimoRef.current
      const f = filtrosGpsPorActividad(tipoActividad)

      if (prev) {
        const delta = haversineDistanceM(prev.lat, prev.lng, p.lat, p.lng)
        // Ruido (el usuario prácticamente no se movió): actualizamos la
        // referencia para no comparar futuros puntos contra una posición
        // vieja, pero no agregamos nada al dibujo.
        if (delta < f.segmentoMinM) {
          ultimoRef.current = { lat: p.lat, lng: p.lng, ts }
          return
        }
        const segundos = (ts - prev.ts) / 1000
        const cortar = delta > f.segmentoMaxM || segundos > SEGMENTO_MAX_SEG
        ultimoRef.current = { lat: p.lat, lng: p.lng, ts }
        setSegmentos((prevSeg) => agregarPunto(prevSeg, [p.lat, p.lng], cortar))
        return
      }

      ultimoRef.current = { lat: p.lat, lng: p.lng, ts }
      setSegmentos((prevSeg) => agregarPunto(prevSeg, [p.lat, p.lng], true))
    })

    return () => sub.remove()
  }, [viajeId, userId, tipoActividad, habilitado])

  return segmentos
}

function agregarPunto(
  segmentos: [number, number][][],
  punto: [number, number],
  cortar: boolean
): [number, number][][] {
  if (cortar || segmentos.length === 0) return [...segmentos, [punto]]
  const ultimo = segmentos[segmentos.length - 1]!
  const anterior = ultimo[ultimo.length - 1]
  if (anterior && anterior[0] === punto[0] && anterior[1] === punto[1]) return segmentos
  const copia = segmentos.slice(0, -1)
  copia.push([...ultimo, punto])
  return copia
}
