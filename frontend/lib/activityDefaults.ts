import type { TipoActividadApi } from './viajesApi'

export type ParametrosActividad = {
  velocidadEsperada: number
  distanciaMaxSeparacion: number
}

export const ACTIVIDADES: { id: TipoActividadApi; label: string }[] = [
  { id: 'moto', label: 'Moto' },
  { id: 'bici', label: 'Bicicleta' },
  { id: 'running', label: 'Running' },
  { id: 'trekking', label: 'Trekking' },
]

const DEFAULTS: Record<TipoActividadApi, ParametrosActividad> = {
  moto: { velocidadEsperada: 120, distanciaMaxSeparacion: 1000 },
  bici: { velocidadEsperada: 35, distanciaMaxSeparacion: 300 },
  running: { velocidadEsperada: 15, distanciaMaxSeparacion: 100 },
  trekking: { velocidadEsperada: 5, distanciaMaxSeparacion: 50 },
}

export function parametrosPorActividad(tipo: TipoActividadApi): ParametrosActividad {
  return DEFAULTS[tipo]
}

export function etiquetaActividad(tipo: string): string {
  return ACTIVIDADES.find((a) => a.id === tipo)?.label ?? tipo
}

export function textoParametrosActividad(tipo: TipoActividadApi): string {
  const { velocidadEsperada, distanciaMaxSeparacion } = parametrosPorActividad(tipo)
  const sep =
    distanciaMaxSeparacion >= 1000
      ? `${distanciaMaxSeparacion / 1000} km`
      : `${distanciaMaxSeparacion} m`
  return `Velocidad esperada: ${velocidadEsperada} km/h · Se alertará si un integrante se aleja más de ${sep}`
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
    default:
      return 'La ruta se calcula según la actividad elegida.'
  }
}

export function actividadValida(val: string | undefined | null): val is TipoActividadApi {
  return val === 'moto' || val === 'bici' || val === 'running' || val === 'trekking'
}

export function actividadInicialDesdePerfil(
  actividadPreferida: string | undefined | null
): TipoActividadApi {
  return actividadValida(actividadPreferida) ? actividadPreferida : 'bici'
}
