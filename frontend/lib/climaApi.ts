import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** Pronóstico sobre la ruta (SCRUM-27, RN-108). Espejo de `ClimaViaje` del spec. */
export type PuntoClimaApi = {
  nombre: string
  lat: number
  lng: number
  hora: string
  temperatura_c: number | null
  prob_precipitacion_pct: number | null
  precipitacion_mm: number | null
  viento_kmh: number | null
  rafagas_kmh: number | null
  codigo_tiempo: number | null
  descripcion: string
  lluvia: boolean
  viento_fuerte: boolean
}

export type AlertaClimaApi = {
  tipo: 'lluvia' | 'viento_fuerte'
  mensaje: string
  puntos: string[]
}

export type ClimaViajeApi = {
  disponible: boolean
  motivo: 'SIN_RUTA' | 'FUERA_DE_HORIZONTE' | 'VIAJE_FINALIZADO' | null
  fuente: 'open-meteo'
  consultado_en: string
  inicio_previsto: string | null
  puntos: PuntoClimaApi[]
  alertas: AlertaClimaApi[]
  resumen: string
}

export async function obtenerClimaViaje(viajeId: string): Promise<ClimaViajeApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/clima`))
  return parseJson<ClimaViajeApi>(res)
}

/** Ícono Feather según el código WMO de Open-Meteo. */
export function iconoClima(codigo: number | null): 'sun' | 'cloud' | 'cloud-drizzle' | 'cloud-rain' | 'cloud-snow' | 'cloud-lightning' | 'wind' {
  if (codigo == null) return 'cloud'
  if (codigo === 0 || codigo === 1) return 'sun'
  if (codigo <= 3 || codigo === 45 || codigo === 48) return 'cloud'
  if (codigo >= 51 && codigo <= 57) return 'cloud-drizzle'
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return 'cloud-rain'
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return 'cloud-snow'
  if (codigo >= 95) return 'cloud-lightning'
  return 'cloud'
}
