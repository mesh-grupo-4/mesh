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

export type ViajePlanificadoApi = {
  id: string
  tipo_actividad: string
  fecha_programada: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
}

export async function listarViajesPlanificadosGrupo(
  grupoId: string,
  userId: string,
  baseUrl?: string
): Promise<ViajePlanificadoApi[]> {
  const res = await meshFetch(apiUrl(`/api/grupos/${grupoId}/viajes-planificados`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajePlanificadoApi[]>(res)
}

export type UnirseQrResponse = {
  grupoId: string
  viajeId: string
  yaEraMiembro: boolean
}

export async function unirseViajePorQr(
  viajeId: string,
  userId: string,
  baseUrl?: string
): Promise<UnirseQrResponse> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/unirse-qr`, baseUrl), {
    method: 'POST',
    headers: await authHeaders(userId),
  })
  return parseJson<UnirseQrResponse>(res)
}

export async function listarGrupos(
  userId: string,
  baseUrl?: string
): Promise<GrupoListItemApi[]> {
  const res = await meshFetch(apiUrl('/api/grupos', baseUrl), {
    headers: await authHeaders(userId),
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
      ...(await authHeaders(userId)),
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
    headers: await authHeaders(userId),
  })
  return parseJson<GrupoDetalleApi>(res)
}
