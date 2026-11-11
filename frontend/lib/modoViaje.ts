import type { ModoViajeApi } from './viajesApi'

/** RN-065: presentación del modo de viaje (etiqueta, tono de Badge y color de ícono). */
export const ETIQUETA_MODO: Record<ModoViajeApi, string> = {
  recreativo: 'Recreativo',
  entrenamiento: 'Entrenamiento',
  competitivo: 'Competitivo',
}

/** Mismos tonos que los badges del detalle del viaje. */
export const TONO_MODO: Record<ModoViajeApi, 'accent' | 'good' | 'warning'> = {
  recreativo: 'accent',
  entrenamiento: 'good',
  competitivo: 'warning',
}

/** Igual al color del Badge `warning` de MeshUI. */
const COLOR_COMPETITIVO = '#e8a838'

export function colorModo(modo: ModoViajeApi, theme: { accent: string; good: string }): string {
  if (modo === 'entrenamiento') return theme.good
  if (modo === 'competitivo') return COLOR_COMPETITIVO
  return theme.accent
}
