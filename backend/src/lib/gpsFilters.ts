/** Umbrales de filtrado GPS según modalidad (RN-021). */

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
