import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-075: racha de semanas consecutivas con al menos un viaje finalizado (E09). */
export type RachaApi = {
  semanas_consecutivas: number
  /** true si la semana pasada tuvo actividad pero esta todavía no: si termina sin salir, se corta. */
  en_riesgo: boolean
}

/** Racha vigente del usuario autenticado. */
export async function obtenerMiRacha(): Promise<RachaApi> {
  const res = await meshFetchAuthed(apiUrl('/api/rachas/mia'))
  return parseJson<RachaApi>(res)
}
