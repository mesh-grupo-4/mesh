import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { TipoActividadApi } from './viajesApi'

/**
 * RN-081 (E10): recorridos del historial publicados para la comunidad. Solo distancia
 * y tiempo, nunca velocidad (RN-070).
 */
export type RecorridoPublicadoApi = {
  id: string
  viaje_id: string
  nombre: string | null
  tipo_actividad: TipoActividadApi
  distancia_m: number
  tiempo_seg: number
  publicado_at: string
  autor: { id: string; nombre: string; apellido: string | null }
}

export type RecorridoPublicadoDetalleApi = RecorridoPublicadoApi & {
  segmentos: [number, number][][]
}

/** Publica (o republica) un viaje finalizado propio. */
export async function publicarRecorrido(viajeId: string): Promise<RecorridoPublicadoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/publicar`), {
    method: 'POST',
  })
  return parseJson<RecorridoPublicadoApi>(res)
}

export async function despublicarRecorrido(viajeId: string): Promise<void> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/publicar`), {
    method: 'DELETE',
  })
  // 204 sin cuerpo: parseJson tolera respuesta vacía y valida el status.
  await parseJson<null>(res)
}

/** Ids de mis viajes que hoy están publicados. */
export async function listarMisViajesPublicados(): Promise<string[]> {
  const res = await meshFetchAuthed(apiUrl('/api/recorridos-publicados/mios'))
  return (await parseJson<{ viaje_ids: string[] }>(res)).viaje_ids
}

export async function listarRecorridosPublicados(opts: {
  tipoActividad?: TipoActividadApi
  offset?: number
  limit?: number
}): Promise<RecorridoPublicadoApi[]> {
  const q = new URLSearchParams()
  if (opts.tipoActividad) q.set('tipoActividad', opts.tipoActividad)
  if (opts.offset) q.set('offset', String(opts.offset))
  if (opts.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  const res = await meshFetchAuthed(apiUrl(`/api/recorridos-publicados${qs ? `?${qs}` : ''}`))
  return parseJson<RecorridoPublicadoApi[]>(res)
}

export async function obtenerRecorridoPublicado(
  recorridoId: string
): Promise<RecorridoPublicadoDetalleApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/recorridos-publicados/${recorridoId}`))
  return parseJson<RecorridoPublicadoDetalleApi>(res)
}
