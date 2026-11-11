import { useEffect, useMemo, useRef, useState } from 'react'

import { avanzarEnRuta, prepararRuta, type AvanceRuta } from '@/lib/geo/routeProgress'

type Options = {
  ruta: [number, number][] | null
  pos: { lat: number; lng: number } | null
  /**
   * Distancia ya recorrida en el viaje. Solo orienta la primera ubicación al volver
   * a entrar a la pantalla: en una ida y vuelta dice si vas de ida o de regreso.
   */
  distanciaRecorridaM?: number
}

/**
 * Avance propio sobre la ruta planificada. Recuerda el avance anterior para no
 * saltar de tramo cuando la ruta pasa dos veces por el mismo lugar.
 */
export function useAvanceRuta({ ruta, pos, distanciaRecorridaM = 0 }: Options) {
  const preparada = useMemo(() => (ruta && ruta.length > 1 ? prepararRuta(ruta) : null), [ruta])
  const [avance, setAvance] = useState<AvanceRuta | null>(null)
  const pistaRef = useRef<number | null>(null)
  const recorridaRef = useRef(distanciaRecorridaM)
  recorridaRef.current = distanciaRecorridaM

  useEffect(() => {
    pistaRef.current = null
    setAvance(null)
  }, [preparada])

  // La distancia recorrida se lee de disco y llega un instante después que la
  // primera posición: cuando aparece, la próxima ubicación vuelve a orientarse con ella.
  const hayRecorrida = distanciaRecorridaM > 0
  useEffect(() => {
    if (hayRecorrida) pistaRef.current = null
  }, [hayRecorrida])

  const lat = pos?.lat
  const lng = pos?.lng
  useEffect(() => {
    if (!preparada || lat == null || lng == null) return
    const pista = pistaRef.current ?? Math.min(recorridaRef.current, preparada.totalM)
    const siguiente = avanzarEnRuta(preparada, { lat, lng }, pista)
    if (!siguiente) return
    pistaRef.current = siguiente.progresoM
    setAvance(siguiente)
  }, [preparada, lat, lng])

  return { ruta: preparada, avance }
}
