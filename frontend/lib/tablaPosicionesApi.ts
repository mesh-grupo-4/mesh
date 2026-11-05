import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-070 / RN-021: la tabla de posiciones global nunca incluye moto (único excluido). */
export type TipoActividadRankingApi = 'bici' | 'running' | 'trekking' | 'otro'
export type PeriodoRankingApi = 'semanal' | 'mensual' | 'anual'
export type OrdenRankingApi = 'distancia' | 'tiempo'

export type FilaTablaPosicionesApi = {
  puesto: number
  usuario_id: string
  nombre: string
  distancia_m: number
  tiempo_movimiento_seg: number
}

/** RN-076: ranking global por actividad y período, nunca por velocidad (RN-070). */
export type TablaPosicionesApi = {
  tipo_actividad: TipoActividadRankingApi
  periodo: PeriodoRankingApi
  orden: OrdenRankingApi
  desde: string
  top: FilaTablaPosicionesApi[]
  mi_posicion: FilaTablaPosicionesApi | null
  total_participantes: number
}

export async function obtenerTablaPosiciones(
  tipoActividad: TipoActividadRankingApi,
  periodo: PeriodoRankingApi = 'semanal',
  orden: OrdenRankingApi = 'distancia'
): Promise<TablaPosicionesApi> {
  const qs = new URLSearchParams({ tipoActividad, periodo, orden })
  const res = await meshFetchAuthed(apiUrl(`/api/tabla-posiciones?${qs.toString()}`))
  return parseJson<TablaPosicionesApi>(res)
}
