import type { TipoActividad } from '@prisma/client'

export type ParametrosActividad = {
  velocidadEsperada: number
  distanciaMaxSeparacion: number
}

const DEFAULTS: Record<TipoActividad, ParametrosActividad> = {
  moto: { velocidadEsperada: 120, distanciaMaxSeparacion: 1000 },
  bici: { velocidadEsperada: 35, distanciaMaxSeparacion: 300 },
  running: { velocidadEsperada: 15, distanciaMaxSeparacion: 100 },
  trekking: { velocidadEsperada: 5, distanciaMaxSeparacion: 50 },
}

/** RN-021: parámetros por defecto según tipo de actividad del viaje. */
export function parametrosPorActividad(tipo: TipoActividad): ParametrosActividad {
  return DEFAULTS[tipo]
}
