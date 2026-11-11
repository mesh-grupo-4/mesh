import { router } from 'expo-router'

/**
 * Contexto con el que se abre "Nuevo viaje". Se reenvía tal cual a la opción
 * elegida ("Viaje YA" → `/viaje/rapido`, "Planificar" → `/viaje/crear`).
 */
export type NuevoViajeParams = {
  /** Ruta de "Mis rutas" a precargar (RN-084). */
  plantillaId?: string
  /** Actividad de esa plantilla (el backend la impone igual). */
  tipoActividad?: string
  /** Grupo desde el que se abrió. */
  grupo?: string
  /** RN-065: abre el flujo con ese modo ya elegido (tab Entrenar → `entrenamiento`). */
  modo?: string
  /** RN-066: sesión de entrenamiento a repetir y qué recorrido usar. */
  repetirViajeId?: string
  recorrido?: string
  /** Nombre sugerido para el viaje (el de la sesión que se repite). */
  nombre?: string
}

/** Abre el selector "Viaje YA / Planificar viaje". Toda entrada a crear un viaje pasa por acá. */
export function abrirNuevoViaje(params: NuevoViajeParams = {}) {
  router.push({ pathname: '/nuevo-viaje', params })
}

/** Tab Entrenar: mismo selector "salir ahora / planificar", ya en modo entrenamiento. */
export function abrirNuevoEntrenamiento() {
  abrirNuevoViaje({ modo: 'entrenamiento' })
}

/** RN-066: abre "Repetir" sobre una sesión de entrenamiento propia. */
export function abrirRepetirEntrenamiento(viajeId: string) {
  router.push({ pathname: '/repetir-entrenamiento', params: { viajeId } })
}

/** Lee un parámetro de ruta que puede venir como string o string[]. */
export function paramTexto(v: string | string[] | undefined): string | undefined {
  const raw = (Array.isArray(v) ? v[0] : v)?.trim()
  return raw ? raw : undefined
}
