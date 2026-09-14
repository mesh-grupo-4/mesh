import type { TipoActividad } from '@prisma/client'
import { umbralesMotorPorActividad } from '../motor-eventos/motorEventos.config'

export type ParametrosActividad = {
  /** km/h */
  velocidadEsperada: number
  /** metros */
  distanciaMaxSeparacion: number
  /** minutos de atraso tolerados respecto del bloque principal (RN-025 / RN-035) */
  toleranciaAtrasoMin: number
}

const DEFAULTS: Record<TipoActividad, Omit<ParametrosActividad, 'toleranciaAtrasoMin'>> = {
  moto: { velocidadEsperada: 120, distanciaMaxSeparacion: 1000 },
  bici: { velocidadEsperada: 35, distanciaMaxSeparacion: 300 },
  running: { velocidadEsperada: 15, distanciaMaxSeparacion: 100 },
  trekking: { velocidadEsperada: 5, distanciaMaxSeparacion: 50 },
  otro: { velocidadEsperada: 20, distanciaMaxSeparacion: 200 },
}

/** RN-021: parámetros por defecto según tipo de actividad del viaje. */
export function parametrosPorActividad(tipo: TipoActividad): ParametrosActividad {
  return {
    ...DEFAULTS[tipo],
    // Única fuente de verdad de la tolerancia: la misma tabla que usa el motor.
    toleranciaAtrasoMin: umbralesMotorPorActividad(tipo).toleranciaAtrasoMinutos,
  }
}

/** Tolerancia que efectivamente usa el motor: la del viaje si el líder la fijó, si no la de la actividad. */
export function toleranciaAtrasoEfectiva(
  tipo: TipoActividad,
  minutosViaje: number | null | undefined
): number {
  if (minutosViaje != null) return minutosViaje
  return parametrosPorActividad(tipo).toleranciaAtrasoMin
}

/** Rangos aceptados al editar parámetros (RN-025). Compartidos entre Zod y la UI. */
export const RANGO_PARAMETROS = {
  velocidadEsperada: { min: 1, max: 300 },
  distanciaMaxSeparacion: { min: 10, max: 20000 },
  toleranciaAtrasoMin: { min: 1, max: 60 },
} as const
