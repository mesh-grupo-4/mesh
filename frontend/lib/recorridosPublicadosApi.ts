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
  /** Portada: la primera de `fotos`; null si publicó sin fotos. */
  foto: string | null
  /**
   * Todas las fotos del autor (URLs públicas), en el orden del carrusel. Leerlas con
   * `fotosDe`: un backend anterior al carrusel no manda este campo.
   */
  fotos?: string[]
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
  /**
   * Cuántas personas lo guardaron en sus rutas (RN-084). Un backend anterior no lo manda:
   * sin dato, la app no muestra la línea.
   */
  guardados?: number
}

export type RecorridoPublicadoDetalleApi = RecorridoPublicadoApi & {
  valoracion: ValoracionRecorridoApi
  /** Plantilla con la que lo guardé en mis rutas; null si no lo guardé. */
  mi_plantilla_id: string | null
  /**
   * Cuántas personas lo guardaron en sus rutas (RN-084). Un backend anterior no lo manda:
   * sin dato, la app no muestra la línea.
   */
  guardados?: number
  segmentos: [number, number][][]
  /** Ítems que compartió el autor; vacío si no compartió ninguno. */
  checklist: string[]
}

/** RN-081: cuántas fotos admite un recorrido publicado (mismo tope que el backend). */
export const FOTOS_RECORRIDO_MAX = 5

/** Fotos del recorrido en orden; si el backend todavía no manda la lista, la portada sola. */
export function fotosDe(r: Pick<RecorridoPublicadoApi, 'foto' | 'fotos'>): string[] {
  return r.fotos ?? (r.foto ? [r.foto] : [])
}

/**
 * Al guardar o quitar el recorrido propio de mis rutas, el total cambia en uno: se ajusta en
 * pantalla sin volver a pedir el listado. Sin dato del backend, queda sin dato.
 */
export function ajustarGuardados(guardados: number | undefined, delta: 1 | -1): number | undefined {
  return guardados === undefined ? undefined : Math.max(guardados + delta, 0)
}

/** Paso 1 de cada foto del recorrido: URL firmada para subir el JPEG antes de publicar. */
export async function crearSubidaFotoRecorrido(
  viajeId: string
): Promise<{ path: string; upload_url: string }> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/foto/subida`), {
    method: 'POST',
  })
  return parseJson<{ path: string; upload_url: string }>(res)
}

/**
 * Publica (o republica) un viaje finalizado propio. `fotoPaths` son los `path` de las fotos
 * ya subidas con `crearSubidaFotoRecorrido`, en el orden del carrusel (la primera es la
 * portada); sin ellos se publica sin fotos.
 */
export async function publicarRecorrido(
  viajeId: string,
  opciones: { comentario?: string; compartirChecklist?: boolean; fotoPaths?: string[] } = {}
): Promise<RecorridoPublicadoApi> {
  const { fotoPaths = [], ...resto } = opciones
  // Un backend anterior al carrusel rechaza `fotoPaths` (campo desconocido) y solo conoce
  // `fotoPath`. Sin fotos o con una sola se manda lo que entienden los dos; recién con
  // varias hace falta el backend nuevo.
  const fotos =
    fotoPaths.length === 0 ? {} : fotoPaths.length === 1 ? { fotoPath: fotoPaths[0] } : { fotoPaths }
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/recorrido/publicar`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...resto, ...fotos }),
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
