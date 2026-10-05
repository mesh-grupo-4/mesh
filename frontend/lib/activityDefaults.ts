import type { TipoActividadApi } from './viajesApi'

export type ParametrosActividad = {
  /** km/h */
  velocidadEsperada: number
  /** metros */
  distanciaMaxSeparacion: number
  /** minutos de atraso tolerados (RN-025) */
  toleranciaAtrasoMin: number
}

/** Rangos aceptados por el backend (espejo de `activityDefaults.ts` del backend). */
export const RANGO_PARAMETROS = {
  velocidadEsperada: { min: 1, max: 300, paso: 5 },
  distanciaMaxSeparacion: { min: 10, max: 20000, paso: 50 },
  toleranciaAtrasoMin: { min: 1, max: 60, paso: 1 },
} as const

export const ACTIVIDADES: { id: TipoActividadApi; label: string }[] = [
  { id: 'moto', label: 'Moto' },
  { id: 'bici', label: 'Bicicleta' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
  { id: 'otro', label: 'Otro' },
]

const DEFAULTS: Record<TipoActividadApi, ParametrosActividad> = {
  moto: { velocidadEsperada: 120, distanciaMaxSeparacion: 1000, toleranciaAtrasoMin: 10 },
  bici: { velocidadEsperada: 35, distanciaMaxSeparacion: 300, toleranciaAtrasoMin: 5 },
  running: { velocidadEsperada: 15, distanciaMaxSeparacion: 100, toleranciaAtrasoMin: 3 },
  trekking: { velocidadEsperada: 5, distanciaMaxSeparacion: 50, toleranciaAtrasoMin: 3 },
  otro: { velocidadEsperada: 20, distanciaMaxSeparacion: 200, toleranciaAtrasoMin: 5 },
}

export function textoSeparacion(metros: number): string {
  return metros >= 1000 ? `${metros / 1000} km` : `${metros} m`
}

export function parametrosPorActividad(tipo: TipoActividadApi): ParametrosActividad {
  return DEFAULTS[tipo]
}

export function etiquetaActividad(tipo: string): string {
  return ACTIVIDADES.find((a) => a.id === tipo)?.label ?? tipo
}

export function textoParametrosActividad(tipo: TipoActividadApi): string {
  const { velocidadEsperada, distanciaMaxSeparacion, toleranciaAtrasoMin } = parametrosPorActividad(tipo)
  return `Velocidad esperada: ${velocidadEsperada} km/h · Separación máxima: ${textoSeparacion(distanciaMaxSeparacion)} · Tolerancia de atraso: ${toleranciaAtrasoMin} min`
}

export function textoPerfilRuta(tipo: TipoActividadApi): string {
  switch (tipo) {
    case 'moto':
      return 'La ruta se calcula para vehículo según la actividad elegida.'
    case 'bici':
      return 'La ruta se calcula para bicicleta según la actividad elegida.'
    case 'running':
    case 'trekking':
      return 'La ruta se calcula a pie según la actividad elegida.'
    case 'otro':
    default:
      return 'La ruta se calcula según la actividad elegida.'
  }
}

export function actividadValida(val: string | undefined | null): val is TipoActividadApi {
  return val === 'moto' || val === 'bici' || val === 'running' || val === 'trekking' || val === 'otro'
}

export function actividadInicialDesdePerfil(
  actividadPreferida: string | undefined | null
): TipoActividadApi {
  return actividadValida(actividadPreferida) ? actividadPreferida : 'bici'
}
