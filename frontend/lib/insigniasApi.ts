import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { TipoActividadApi } from './viajesApi'

/** RN-074: catálogo de logros otorgados automáticamente al finalizar un viaje (E09). */
export type InsigniaApi = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string
  criterio_distancia_m: number | null
  criterio_duracion_seg: number | null
  criterio_actividad: TipoActividadApi | null
}

export type InsigniaObtenidaApi = {
  id: string
  insignia_id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string
  viaje_id: string | null
  obtenida_at: string
}

/** Catálogo completo de insignias activas, incluidas las que todavía no se consiguieron. */
export async function listarCatalogoInsignias(): Promise<InsigniaApi[]> {
  const res = await meshFetchAuthed(apiUrl('/api/insignias'))
  return parseJson<InsigniaApi[]>(res)
}

/** Insignias propias, más reciente primero. */
export async function listarMisInsignias(): Promise<InsigniaObtenidaApi[]> {
  const res = await meshFetchAuthed(apiUrl('/api/insignias/mias'))
  return parseJson<InsigniaObtenidaApi[]>(res)
}

/** Insignias de otro usuario: son públicas dentro de la comunidad (RN-074). */
export async function listarInsigniasDeUsuario(usuarioId: string): Promise<InsigniaObtenidaApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/insignias/usuario/${usuarioId}`))
  return parseJson<InsigniaObtenidaApi[]>(res)
}
