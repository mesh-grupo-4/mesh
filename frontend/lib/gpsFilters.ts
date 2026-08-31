/** Umbrales de filtrado GPS en cliente — espejo de `backend/src/lib/gpsFilters.ts`. */

export type FiltrosGps = {
  precisionMaxM: number
  segmentoMinM: number
  segmentoMaxM: number
  velocidadMaxKmh: number
}

const DEFAULTS: FiltrosGps = {
  precisionMaxM: 50,
  segmentoMinM: 2,
  segmentoMaxM: 120,
  velocidadMaxKmh: 60,
}

const POR_ACTIVIDAD: Record<string, FiltrosGps> = {
  trekking: {
    precisionMaxM: 30,
    segmentoMinM: 4,
    segmentoMaxM: 25,
    velocidadMaxKmh: 12,
  },
  running: {
    precisionMaxM: 35,
    segmentoMinM: 3,
    segmentoMaxM: 40,
    velocidadMaxKmh: 25,
  },
  bici: {
    precisionMaxM: 40,
    segmentoMinM: 2,
    segmentoMaxM: 80,
    velocidadMaxKmh: 80,
  },
  moto: {
    precisionMaxM: 50,
    segmentoMinM: 2,
    segmentoMaxM: 500,
    velocidadMaxKmh: 200,
  },
  otro: DEFAULTS,
}

export function filtrosGpsPorActividad(tipoActividad: string): FiltrosGps {
  return POR_ACTIVIDAD[tipoActividad] ?? DEFAULTS
}

/** Hueco largo (app en background o sin señal): no unimos el tramo con una línea recta.
 * Espejo de `SEGMENTO_MAX_SEG` en `backend/src/lib/postgis.ts`. */
export const SEGMENTO_MAX_SEG = 120

/** Velocidad implícita entre dos puntos consecutivos (km/h). */
export function velocidadImplicitaKmh(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  segundos: number
): number | null {
  if (segundos <= 0) return null
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const metros = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return (metros / segundos) * 3.6
}
