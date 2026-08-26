import { useEffect, useRef, useState } from 'react'

import { haversineDistanceM } from '@/lib/geo/haversine'

const RADIO_LLEGADA_M = 40
const PINGS_CONFIRMAR = 2

type Destino = { lat: number; lng: number; nombre: string | null }

type Options = {
  destino: Destino | null
  pos: { lat: number; lng: number } | null
  habilitado?: boolean
}

/** Detecta llegada al destino con N pings consecutivos dentro del radio. */
export function useLlegadaDestino({ destino, pos, habilitado = true }: Options) {
  const [llegada, setLlegada] = useState(false)
  const [descartada, setDescartada] = useState(false)
  const contadorRef = useRef(0)

  useEffect(() => {
    contadorRef.current = 0
    setLlegada(false)
    setDescartada(false)
  }, [destino?.lat, destino?.lng])

  useEffect(() => {
    if (!habilitado || descartada || llegada || !destino || !pos) return

    const d = haversineDistanceM(pos.lat, pos.lng, destino.lat, destino.lng)
    if (d <= RADIO_LLEGADA_M) {
      contadorRef.current += 1
      if (contadorRef.current >= PINGS_CONFIRMAR) {
        setLlegada(true)
      }
    } else {
      contadorRef.current = 0
    }
  }, [destino, pos, habilitado, descartada, llegada])

  const descartar = () => setDescartada(true)

  return { llegada, descartada, descartar, destinoNombre: destino?.nombre ?? 'Destino' }
}
