/** Umbrales de filtrado GPS según modalidad (RN-021). */

/**
 * Con el teléfono quieto, cada lectura cae unos metros al lado de la anterior: tramo por
 * tramo parece movimiento, pero en un minuto la persona no se alejó. Un tramo solo cuenta
 * si el desplazamiento neto de la ventana (±30 s) o el propio tramo superan este radio.
 * Caminando despacio (1,5 km/h) se recorren 25 m por minuto.
 */
export const RADIO_QUIETO_M = 20

/**
 * Por debajo de esta distancia total no hay recorrido que medir: es el ruido que se escapó
 * del filtro anterior, y un ritmo calculado sobre eso no significa nada.
 */
export const DISTANCIA_MINIMA_M = 100

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
  auto: {
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
