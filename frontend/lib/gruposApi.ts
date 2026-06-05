import { apiUrl, authHeaders, meshFetch, parseJson } from './apiClient'

export type RolGrupoApi = 'lider' | 'participante'

export type GrupoApi = {
  id: string
  nombre: string
  fecha_creacion: string
  lider_id: string
}

export type GrupoDetalleApi = GrupoApi & {
  mi_rol: RolGrupoApi
}

export type GrupoListItemApi = GrupoApi & {
  mi_rol: RolGrupoApi
}

export type GrupoMiembroApi = {
  id: string
  nombre: string
  email: string
  rol: RolGrupoApi
  fecha_union: string
}

export type CambiarRolMiembroResponse = {
  usuario_id: string
  rol: RolGrupoApi
}

export type GrupoMutationResponse = {
  accion: 'abandonado' | 'grupo_eliminado'
  grupo_id?: string
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

export async function listarMiembrosGrupo(
  grupoId: string,
  userId: string,
  baseUrl?: string
): Promise<GrupoMiembroApi[]> {
  const res = await meshFetch(apiUrl(`/api/grupos/${grupoId}/miembros`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<GrupoMiembroApi[]>(res)
}

export async function cambiarRolMiembroGrupo(
  grupoId: string,
  miembroId: string,
  rol: RolGrupoApi,
  userId: string,
  baseUrl?: string
): Promise<CambiarRolMiembroResponse> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoId}/miembros/${miembroId}/rol`, baseUrl),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(userId)),
      },
      body: JSON.stringify({ rol }),
    }
  )
  return parseJson<CambiarRolMiembroResponse>(res)
}

export async function abandonarGrupo(
  grupoId: string,
  userId: string,
  nuevoLiderId?: string,
  baseUrl?: string
): Promise<GrupoMutationResponse> {
  const body = nuevoLiderId ? { nuevo_lider_id: nuevoLiderId } : {}
  const res = await meshFetch(apiUrl(`/api/grupos/${grupoId}/abandonar`, baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify(body),
  })
  return parseJson<GrupoMutationResponse>(res)
}

export async function eliminarGrupo(
  grupoId: string,
  userId: string,
  baseUrl?: string
): Promise<GrupoMutationResponse> {
  const res = await meshFetch(apiUrl(`/api/grupos/${grupoId}`, baseUrl), {
    method: 'DELETE',
    headers: await authHeaders(userId),
  })
  return parseJson<GrupoMutationResponse>(res)
}
