import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { RutaPlantillaDetalleApi } from './rutasCompartidasApi'
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

/**
 * RN-082 (SCRUM-63): "Recomiendo" / "No recomiendo". `porcentaje_recomienda` es null si
 * nadie valoró todavía; `mi_valoracion` es null si quien consulta no lo valoró.
 */
export type ValoracionRecorridoApi = {
  recomiendan: number
  no_recomiendan: number
  total: number
  porcentaje_recomienda: number | null
  mi_valoracion: boolean | null
}

/** Texto corto de la valoración para listas y detalle (ej. "75 % lo recomienda · 12 valoraciones"). */
export function textoValoracion(v: ValoracionRecorridoApi): string {
  if (v.total === 0 || v.porcentaje_recomienda === null) return 'Sin valoraciones todavía'
  return `${v.porcentaje_recomienda} % lo recomienda · ${v.total} ${
    v.total === 1 ? 'valoración' : 'valoraciones'
  }`
}

/** Recorrido tal como aparece al explorar la comunidad: con su valoración. */
export type RecorridoComunidadApi = RecorridoPublicadoApi & {
  valoracion: ValoracionRecorridoApi
}

export type RecorridoPublicadoDetalleApi = RecorridoComunidadApi & {
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

/** SCRUM-62: centro y radio de la zona geográfica a explorar. */
export type ZonaBusquedaApi = { lat: number; lng: number; radioKm: number }

export async function listarRecorridosPublicados(opts: {
  tipoActividad?: TipoActividadApi
  zona?: ZonaBusquedaApi
  offset?: number
  limit?: number
}): Promise<RecorridoComunidadApi[]> {
  const q = new URLSearchParams()
  if (opts.tipoActividad) q.set('tipoActividad', opts.tipoActividad)
  if (opts.zona) {
    q.set('lat', String(opts.zona.lat))
    q.set('lng', String(opts.zona.lng))
    q.set('radioKm', String(opts.zona.radioKm))
  }
  if (opts.offset) q.set('offset', String(opts.offset))
  if (opts.limit) q.set('limit', String(opts.limit))
  const qs = q.toString()
  const res = await meshFetchAuthed(apiUrl(`/api/recorridos-publicados${qs ? `?${qs}` : ''}`))
  return parseJson<RecorridoComunidadApi[]>(res)
}

export async function obtenerRecorridoPublicado(
  recorridoId: string
): Promise<RecorridoPublicadoDetalleApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/recorridos-publicados/${recorridoId}`))
  return parseJson<RecorridoPublicadoDetalleApi>(res)
}

/**
 * RN-084: copia el recorrido a "Mis rutas" como plantilla para crear un viaje con esa base.
 * Idempotente: si ya se había importado devuelve la misma plantilla (`ya_existia`).
 */
export async function importarRecorridoPublicado(
  recorridoId: string
): Promise<{ plantilla: RutaPlantillaDetalleApi; ya_existia: boolean }> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/recorridos-publicados/${recorridoId}/importaciones`),
    { method: 'POST' }
  )
  return parseJson<{ plantilla: RutaPlantillaDetalleApi; ya_existia: boolean }>(res)
}

/** Una sola vez por recorrido; no se puede cambiar después (RN-082). Sin texto (RN-083). */
export async function valorarRecorrido(
  recorridoId: string,
  recomiendo: boolean
): Promise<ValoracionRecorridoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/recorridos-publicados/${recorridoId}/valoracion`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recomiendo }),
  })
  return parseJson<ValoracionRecorridoApi>(res)
}
