import { API_BASE_URL } from '@/constants/Config'
import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { TipoActividadApi } from './viajesApi'

export type RutaSnapshotPreviewApi = {
  tipo_actividad: TipoActividadApi
  origen: { lat: number; lng: number; nombre: string | null }
  destino: { lat: number; lng: number; nombre: string | null }
  linestring_geojson: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  distancia_planeada_m: number | null
  tiempo_estimado_seg: number | null
  paradas: Array<{
    orden: number
    lat: number
    lng: number
    nombre: string | null
    categoria: string
  }>
}

export type RutaPlantillaResumenApi = {
  id: string
  nombre: string
  tipo_actividad: TipoActividadApi
  distancia_planeada_m: number | null
  tiempo_estimado_seg: number | null
  origen_nombre: string | null
  destino_nombre: string | null
  created_at: string
}

export type RutaPlantillaDetalleApi = RutaSnapshotPreviewApi & {
  id: string
  nombre: string
  created_at: string
}

export type CompartirRutaResponseApi = {
  token: string
  link: string
  revocado: boolean
}

export async function compartirRutaViaje(
  viajeId: string,
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<CompartirRutaResponseApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/ruta/compartir`, baseUrl), {
    method: 'POST',
  })
  return parseJson<CompartirRutaResponseApi>(res)
}

export async function revocarCompartirRutaViaje(
  viajeId: string,
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<{ revocado: boolean }> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/ruta/compartir`, baseUrl), {
    method: 'DELETE',
  })
  return parseJson<{ revocado: boolean }>(res)
}

export async function previewRutaCompartida(
  token: string,
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<RutaSnapshotPreviewApi> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/rutas-compartidas/${encodeURIComponent(token)}`, baseUrl),
    { method: 'GET' }
  )
  return parseJson<RutaSnapshotPreviewApi>(res)
}

export async function importarRutaCompartida(
  token: string,
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<{ plantilla: RutaPlantillaDetalleApi; ya_existia: boolean }> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/rutas-compartidas/${encodeURIComponent(token)}/importaciones`, baseUrl),
    { method: 'POST' }
  )
  return parseJson(res)
}

export async function listarRutasPlantilla(
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<RutaPlantillaResumenApi[]> {
  const res = await meshFetchAuthed(apiUrl('/api/rutas-plantilla', baseUrl), { method: 'GET' })
  return parseJson<RutaPlantillaResumenApi[]>(res)
}

export async function eliminarRutaPlantilla(
  plantillaId: string,
  _userId: string,
  baseUrl: string = API_BASE_URL
): Promise<{ eliminada: boolean }> {
  const res = await meshFetchAuthed(apiUrl(`/api/rutas-plantilla/${plantillaId}`, baseUrl), {
    method: 'DELETE',
  })
  return parseJson(res)
}
