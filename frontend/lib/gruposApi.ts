import { apiUrl, authHeaders, meshFetch, parseJson } from './apiClient'

export type GrupoApi = {
  id: string
  nombre: string
  fecha_creacion: string
  lider_id: string
}

export type GrupoDetalleApi = GrupoApi & {
  mi_rol: 'lider' | 'participante'
}

export type GrupoListItemApi = GrupoApi & {
  mi_rol: 'lider' | 'participante'
}

export async function listarGrupos(
  userId: string,
  baseUrl?: string
): Promise<GrupoListItemApi[]> {
  const res = await meshFetch(apiUrl('/api/grupos', baseUrl), {
    headers: authHeaders(userId),
  })
  return parseJson<GrupoListItemApi[]>(res)
}

export async function crearGrupo(
  nombre: string,
  userId: string,
  baseUrl?: string
): Promise<GrupoApi> {
  const res = await meshFetch(apiUrl('/api/grupos', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(userId),
    },
    body: JSON.stringify({ nombre }),
  })
  return parseJson<GrupoApi>(res)
}

export async function obtenerGrupo(
  grupoId: string,
  userId: string,
  baseUrl?: string
): Promise<GrupoDetalleApi> {
  const res = await meshFetch(apiUrl(`/api/grupos/${grupoId}`, baseUrl), {
    headers: authHeaders(userId),
  })
  return parseJson<GrupoDetalleApi>(res)
}
