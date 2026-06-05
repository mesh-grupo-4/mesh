import { apiUrl, authHeaders, meshFetch, parseJson } from './apiClient'

export type AmigoApi = {
  id: string
  nombre: string
  email: string
}

export type SolicitudAmistadPendienteApi = {
  id: string
  created_at: string
  solicitante: AmigoApi
}

export type SolicitarAmistadResponse = {
  id: string
  created_at: string
  destinatario: { id: string; nombre: string }
}

export type ResponderSolicitudAmistadResponse = {
  solicitud_id: string
  accion: 'aceptada' | 'rechazada'
  amigo_id: string
  amigo_nombre: string
}

export type RelacionAmistad = 'amigo' | 'solicitud_enviada' | 'solicitud_recibida' | null

export type UsuarioBusquedaAmistadApi = {
  id: string
  nombre: string
  email: string
  relacion: RelacionAmistad
}

export type EliminarAmigoResponse = {
  amigo_id: string
}

export async function listarAmigos(
  userId: string,
  baseUrl?: string
): Promise<AmigoApi[]> {
  const res = await meshFetch(apiUrl('/api/amistades', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<AmigoApi[]>(res)
}

export async function listarSolicitudesAmistadPendientes(
  userId: string,
  baseUrl?: string
): Promise<SolicitudAmistadPendienteApi[]> {
  const res = await meshFetch(apiUrl('/api/amistades/solicitudes/pendientes', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<SolicitudAmistadPendienteApi[]>(res)
}

export async function solicitarAmistad(
  destinatarioId: string,
  userId: string,
  baseUrl?: string
): Promise<SolicitarAmistadResponse> {
  const res = await meshFetch(apiUrl('/api/amistades/solicitar', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify({ usuario_id: destinatarioId }),
  })
  return parseJson<SolicitarAmistadResponse>(res)
}

export async function responderSolicitudAmistad(
  solicitudId: string,
  accion: 'aceptar' | 'rechazar',
  userId: string,
  baseUrl?: string
): Promise<ResponderSolicitudAmistadResponse> {
  const res = await meshFetch(
    apiUrl(`/api/amistades/solicitudes/${solicitudId}/responder`, baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(userId)),
      },
      body: JSON.stringify({ accion }),
    }
  )
  return parseJson<ResponderSolicitudAmistadResponse>(res)
}

export async function buscarUsuariosAmistad(
  query: string,
  userId: string,
  baseUrl?: string
): Promise<UsuarioBusquedaAmistadApi[]> {
  const params = new URLSearchParams({ q: query })
  const res = await meshFetch(apiUrl(`/api/amistades/buscar?${params}`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<UsuarioBusquedaAmistadApi[]>(res)
}

export async function eliminarAmigo(
  amigoId: string,
  userId: string,
  baseUrl?: string
): Promise<EliminarAmigoResponse> {
  const res = await meshFetch(apiUrl(`/api/amistades/${amigoId}`, baseUrl), {
    method: 'DELETE',
    headers: await authHeaders(userId),
  })
  return parseJson<EliminarAmigoResponse>(res)
}
