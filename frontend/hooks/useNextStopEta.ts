import { useEffect, useMemo, useState } from 'react'

import { calcNextStop, type NextStopInfo, type RouteStop } from '@/lib/geo/nextStop'
import { ubicarEnOrden, type AvanceRuta, type RutaPreparada } from '@/lib/geo/routeProgress'

/** Debajo de esta fracción de la velocidad esperada se considera que estás detenido. */
const FRACCION_EN_MARCHA = 0.25
const VELOCIDAD_MINIMA_KMH = 2
/** Peso de cada lectura nueva: la estimación no salta con cada ping. */
const PESO_LECTURA = 0.3

type Options = {
  ruta: RutaPreparada | null
  avance: AvanceRuta | null
  stops: RouteStop[]
  /** Velocidad configurada para el viaje: se usa hasta tener un ritmo real. */
  velocidadEsperadaKmh: number
  /** Velocidad reciente medida por GPS; `null` sin datos. */
  velocidadActualKmh: number | null
}

/**
 * Tiempo estimado hasta la próxima parada: distancia que falta sobre la ruta
 * dividida por tu ritmo real reciente. Detenido (o antes de arrancar) se usa el
 * último ritmo en marcha o, si no hay, la velocidad esperada del viaje.
 *
 * Es una estimación propia: no se compara con nadie (RN-070).
 */
export function useNextStopEta({
  ruta,
  avance,
  stops,
  velocidadEsperadaKmh,
  velocidadActualKmh,
}: Options): NextStopInfo | null {
  const [ritmoKmh, setRitmoKmh] = useState<number | null>(null)

  useEffect(() => {
    if (velocidadActualKmh == null) return
    const enMarcha =
      velocidadActualKmh >= Math.max(VELOCIDAD_MINIMA_KMH, velocidadEsperadaKmh * FRACCION_EN_MARCHA)
    if (!enMarcha) return
    setRitmoKmh((previo) =>
      previo == null ? velocidadActualKmh : previo * (1 - PESO_LECTURA) + velocidadActualKmh * PESO_LECTURA
    )
  }, [velocidadActualKmh, velocidadEsperadaKmh])

  const paradasM = useMemo(() => (ruta ? ubicarEnOrden(ruta, stops) : []), [ruta, stops])

  return useMemo(() => {
    if (!avance || !ruta) return null
    return calcNextStop(avance, stops, paradasM, ritmoKmh ?? velocidadEsperadaKmh)
  }, [avance, ruta, stops, paradasM, ritmoKmh, velocidadEsperadaKmh])
}
