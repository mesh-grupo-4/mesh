import { useEffect, useRef, useState } from 'react'

import { haversineDistanceM } from '@/lib/geo/haversine'
import type { AvanceRuta } from '@/lib/geo/routeProgress'

/** Tiempo que hay que permanecer dentro del radio: pasar de largo no cuenta como llegar. */
const PERMANENCIA_MS = 5000
/** Tramo final de la ruta en el que ya se puede dar por llegado. */
const TRAMO_FINAL_MIN_M = 150

type Punto = { lat: number; lng: number }
type Destino = Punto & { nombre: string | null }

type Options = {
  destino: Destino | null
  /** Último punto del trazado: el destino elegido puede no estar sobre el camino. */
  finRuta?: Punto | null
  pos: Punto | null
  /**
   * Avance sobre la ruta. En un circuito el destino coincide con el origen: sin
   * esto se avisaría la llegada apenas arranca el viaje.
   */
  avance?: AvanceRuta | null
  radioM?: number
  habilitado?: boolean
}

/** Detecta la llegada al destino: dentro del radio, en el tramo final y sin pasar de largo. */
export function useLlegadaDestino({
  destino,
  finRuta = null,
  pos,
  avance = null,
  radioM = 40,
  habilitado = true,
}: Options) {
  const [llegada, setLlegada] = useState(false)
  const [descartada, setDescartada] = useState(false)
  const dentroDesdeRef = useRef<number | null>(null)

  useEffect(() => {
    dentroDesdeRef.current = null
    setLlegada(false)
    setDescartada(false)
  }, [destino?.lat, destino?.lng])

  const enTramoFinal =
    !avance ||
    avance.totalM <= 0 ||
    avance.progresoM >= avance.totalM - Math.max(radioM * 2, TRAMO_FINAL_MIN_M)

  const cerca =
    destino != null &&
    pos != null &&
    (haversineDistanceM(pos.lat, pos.lng, destino.lat, destino.lng) <= radioM ||
      (finRuta != null && haversineDistanceM(pos.lat, pos.lng, finRuta.lat, finRuta.lng) <= radioM))

  const enDestino = habilitado && cerca && enTramoFinal

  useEffect(() => {
    if (llegada) return
    if (!enDestino) {
      dentroDesdeRef.current = null
      return
    }
    dentroDesdeRef.current ??= Date.now()
    const falta = PERMANENCIA_MS - (Date.now() - dentroDesdeRef.current)
    if (falta <= 0) {
      setLlegada(true)
      return
    }
    // Detenido en el destino pueden no llegar más posiciones: se confirma por tiempo.
    const id = setTimeout(() => setLlegada(true), falta)
    return () => clearTimeout(id)
  }, [enDestino, llegada, pos?.lat, pos?.lng])

  const descartar = () => setDescartada(true)

  return {
    /** Llegó al destino (queda en true aunque se cierre el aviso). */
    llego: llegada,
    /** Hay que mostrar el aviso de llegada. */
    llegada: llegada && !descartada,
    descartar,
    destinoNombre: destino?.nombre ?? 'Destino',
  }
}
