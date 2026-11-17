import type { StopCategory } from '@/components/route-config/routeTypes'
import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/**
 * RN-134: minutos promedio de una parada planificada según su categoría. Los define el
 * superadmin; el backend es la fuente de verdad (`GET /api/routing/duraciones-parada`).
 */
export type DuracionesParada = Record<StopCategory, number>

/**
 * Espejo de los valores por defecto del backend (`backend/src/modules/paradas/
 * duracionesParada.ts`). Solo se usan si no se pudo leer la configuración (sin red):
 * así el planificador igual estima algo razonable.
 */
export const DURACIONES_PARADA_POR_DEFECTO: DuracionesParada = {
  combustible: 10,
  descanso: 15,
  gastronomia: 45,
  sanitario: 10,
  punto_control: 5,
  otro: 15,
}

export async function obtenerDuracionesParada(): Promise<DuracionesParada> {
  const res = await meshFetchAuthed(apiUrl('/api/routing/duraciones-parada'))
  const { minutos } = await parseJson<{ minutos: DuracionesParada }>(res)
  return minutos
}

/** Segundos que suman las paradas planificadas. Una parada sin categoría cuenta como `otro`. */
export function tiempoParadasSeg(
  categorias: readonly (StopCategory | null | undefined)[],
  duraciones: DuracionesParada
): number {
  return categorias.reduce((seg, c) => seg + (duraciones[c ?? 'otro'] ?? 0) * 60, 0)
}
