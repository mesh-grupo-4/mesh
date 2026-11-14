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
  /** Nota del autor al publicar. La comunidad no comenta (RN-083). */
  comentario: string | null
  /** Foto que el autor adjuntó al publicar (URL pública); null si publicó sin foto. */
  foto: string | null
  tiene_checklist: boolean
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
  /** 80 % o más con al menos 3 valoraciones: lo decide el backend, que además los lista primero. */
  muy_recomendado: boolean
  mi_valoracion: boolean | null
}

/** Texto corto de la valoración para listas y detalle (ej. "75 % lo recomienda · 12 valoraciones"). */
export function textoValoracion(v: ValoracionRecorridoApi): string {
  if (v.total === 0 || v.porcentaje_recomienda === null) return 'Sin valoraciones todavía'
  return `${v.porcentaje_recomienda} % lo recomienda · ${v.total} ${
    v.total === 1 ? 'valoración' : 'valoraciones'
  }`
}

/**
 * Antigüedad, racha e insignias de quien publicó. Solo destaca la tarjeta: el orden depende
 * de la valoración del recorrido (RN-082), no del autor. Nunca usa velocidad (RN-070).
 */
export type ReputacionAutorApi = {
  miembro_desde: string
  racha_semanas: number
  insignias_total: number
  /** Hasta 3, las raras primero. */
  insignias_destacadas: { codigo: string; nombre: string; icono: string; rara: boolean }[]
  nivel: 'comun' | 'destacado' | 'leyenda'
}

const MS_MES = 30.44 * 86_400_000

/** Ej. "Nuevo en Mesh", "8 meses en Mesh", "2 años en Mesh". */
export function textoAntiguedad(miembroDesde: string, ahora: Date = new Date()): string {
  const meses = Math.floor((ahora.getTime() - Date.parse(miembroDesde)) / MS_MES)
  if (meses < 1) return 'Nuevo en Mesh'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'} en Mesh`
  const anios = Math.floor(meses / 12)
  return `${anios} ${anios === 1 ? 'año' : 'años'} en Mesh`
}

/** Recorrido tal como aparece al explorar la comunidad. */
export type RecorridoComunidadApi = RecorridoPublicadoApi & {
  valoracion: ValoracionRecorridoApi
  reputacion_autor: ReputacionAutorApi
  /** Plantilla con la que lo guardé en mis rutas; null si no lo guardé. */
  mi_plantilla_id: string | null
}

export type RecorridoPublicadoDetalleApi = RecorridoPublicadoApi & {
  valoracion: ValoracionRecorridoApi
  /** Plantilla con la que lo guardé en mis rutas; null si no lo guardé. */
  mi_plantilla_id: string | null
  segmentos: [number, number][][]
  /** Ítems que compartió el autor; vacío si no compartió ninguno. */
  checklist: string[]
}

/** Paso 1 de la foto del recorrido: URL firmada para subir el JPEG antes de publicar. */
export async function crearSubidaFotoRecorrido(
  viajeId: string
): Promise<{ path: string; upload_url: string }> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/foto/subida`), {
    method: 'POST',
  })
  return parseJson<{ path: string; upload_url: string }>(res)
}

/**
 * Publica (o republica) un viaje finalizado propio. `fotoPath` es el `path` de una foto ya
 * subida con `crearSubidaFotoRecorrido`; sin él se publica sin foto.
 */
export async function publicarRecorrido(
  viajeId: string,
  opciones: { comentario?: string; compartirChecklist?: boolean; fotoPath?: string } = {}
): Promise<RecorridoPublicadoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/publicar`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opciones),
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
  /** Busca en nombre, comentario y autor. */
  q?: string
  tipoActividad?: TipoActividadApi
  zona?: ZonaBusquedaApi
  offset?: number
  limit?: number
}): Promise<RecorridoComunidadApi[]> {
  const q = new URLSearchParams()
  if (opts.q) q.set('q', opts.q)
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
 * Idempotente: si ya se había importado devuelve la misma plantilla (`ya_existia`) y aplica
 * la última elección sobre el checklist.
 */
export async function importarRecorridoPublicado(
  recorridoId: string,
  opciones: { guardarChecklist?: boolean } = {}
): Promise<{ plantilla: RutaPlantillaDetalleApi; ya_existia: boolean }> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/recorridos-publicados/${recorridoId}/importaciones`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opciones),
    }
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
