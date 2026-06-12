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

export type GrupoInvitableApi = {
  id: string
  nombre: string
  cantidad_integrantes: number
}

export type UsuarioInvitableApi = {
  id: string
  nombre: string
  email: string
  grupos_origen: Array<{ id: string; nombre: string }>
}

export type UsuarioParaInvitarApi = {
  id: string
  nombre: string
  email: string
  ya_es_miembro: boolean
  invitacion_pendiente: boolean
}

export type InvitarUsuariosResponse = {
  invitaciones_creadas: number
  invitados: Array<{ id: string; nombre: string }>
}

export type InvitarDesdeGruposOrigenResult = {
  id: string
  nombre: string
  invitaciones_creadas: number
}

export type InvitarDesdeGruposResponse = {
  invitaciones_creadas: number
  omitidos_ya_miembros: number
  grupos_origen: InvitarDesdeGruposOrigenResult[]
}

export type InvitacionPendienteApi = {
  id: string
  created_at: string
  grupo: { id: string; nombre: string }
  grupo_origen: { id: string; nombre: string } | null
  invitado_por: { id: string; nombre: string }
}

export type ResponderInvitacionResponse = {
  invitacion_id: string
  grupo_id: string
  grupo_nombre: string
  accion: 'aceptada' | 'rechazada'
  ya_era_miembro?: boolean
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

export async function listarAmigosParaInvitar(
  grupoDestinoId: string,
  userId: string,
  baseUrl?: string
): Promise<UsuarioParaInvitarApi[]> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/amigos-para-invitar`, baseUrl),
    { headers: await authHeaders(userId) }
  )
  return parseJson<UsuarioParaInvitarApi[]>(res)
}

export async function buscarUsuariosParaInvitar(
  grupoDestinoId: string,
  query: string,
  userId: string,
  baseUrl?: string
): Promise<UsuarioParaInvitarApi[]> {
  const params = new URLSearchParams({ q: query })
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/buscar-usuarios?${params}`, baseUrl),
    { headers: await authHeaders(userId) }
  )
  return parseJson<UsuarioParaInvitarApi[]>(res)
}

export async function listarUsuariosParaInvitar(
  grupoDestinoId: string,
  userId: string,
  baseUrl?: string
): Promise<UsuarioInvitableApi[]> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/usuarios-para-invitar`, baseUrl),
    { headers: await authHeaders(userId) }
  )
  return parseJson<UsuarioInvitableApi[]>(res)
}

export async function invitarUsuarios(
  grupoDestinoId: string,
  usuarioIds: string[],
  userId: string,
  baseUrl?: string
): Promise<InvitarUsuariosResponse> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/invitar-usuarios`, baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(userId)),
      },
      body: JSON.stringify({ usuario_ids: usuarioIds }),
    }
  )
  return parseJson<InvitarUsuariosResponse>(res)
}

export async function listarGruposParaInvitar(
  grupoDestinoId: string,
  userId: string,
  baseUrl?: string
): Promise<GrupoInvitableApi[]> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/grupos-para-invitar`, baseUrl),
    { headers: await authHeaders(userId) }
  )
  return parseJson<GrupoInvitableApi[]>(res)
}

export async function invitarDesdeGrupos(
  grupoDestinoId: string,
  grupoOrigenIds: string[],
  userId: string,
  baseUrl?: string
): Promise<InvitarDesdeGruposResponse> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/${grupoDestinoId}/invitar-desde-grupos`, baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(userId)),
      },
      body: JSON.stringify({ grupo_origen_ids: grupoOrigenIds }),
    }
  )
  return parseJson<InvitarDesdeGruposResponse>(res)
}

export async function listarInvitacionesPendientes(
  userId: string,
  baseUrl?: string
): Promise<InvitacionPendienteApi[]> {
  const res = await meshFetch(apiUrl('/api/grupos/invitaciones/pendientes', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<InvitacionPendienteApi[]>(res)
}

export async function responderInvitacion(
  invitacionId: string,
  accion: 'aceptar' | 'rechazar',
  userId: string,
  baseUrl?: string
): Promise<ResponderInvitacionResponse> {
  const res = await meshFetch(
    apiUrl(`/api/grupos/invitaciones/${invitacionId}/responder`, baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(userId)),
      },
      body: JSON.stringify({ accion }),
    }
  )
  return parseJson<ResponderInvitacionResponse>(res)
}
