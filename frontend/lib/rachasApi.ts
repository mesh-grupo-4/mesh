import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-075: racha de semanas consecutivas con al menos un viaje finalizado (E09). */
export type RachaApi = {
  semanas_consecutivas: number
  /** true si la semana pasada tuvo actividad pero esta todavía no: si termina sin salir, se corta. */
  en_riesgo: boolean
}

/** RN-075: mismos hitos que notifica el backend. */
const HITOS_RACHA = [3, 5, 10] as const

/** Cuántos hitos de racha alcanzó: gradúa los efectos visuales (0 = ninguno). */
export function nivelRacha(semanas: number): number {
  return HITOS_RACHA.filter((hito) => semanas >= hito).length
}

/** De 0 a 1: qué tan cerca está de la racha máxima. */
export function intensidadRacha(semanas: number): number {
  return Math.min(semanas / HITOS_RACHA[HITOS_RACHA.length - 1]!, 1)
}

/** Racha vigente del usuario autenticado. */
export async function obtenerMiRacha(): Promise<RachaApi> {
  const res = await meshFetchAuthed(apiUrl('/api/rachas/mia'))
  return parseJson<RachaApi>(res)
}
