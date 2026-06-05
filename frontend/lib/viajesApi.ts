import { API_BASE_URL } from '@/constants/Config'
import type { PutRutaBody } from './viajesTypes'
import { apiUrl, authHeaders, meshFetch, parseJson } from './apiClient'

export type TipoActividadApi = 'moto' | 'bici' | 'running' | 'trekking'

export type ViajeCreadoApi = {
  id: string
  nombre?: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: TipoActividadApi
  estado: 'planificado' | 'en_curso' | 'finalizado'
  fecha_programada: string
  invitaciones_enviadas?: number
}

export type ViajePlanificadoApi = {
  id: string
  nombre?: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: TipoActividadApi
  fecha_programada: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
  mi_estado: 'creador' | 'confirmado' | 'pendiente' | 'rechazado' | null
}

export type InvitacionViajePendienteApi = {
  viaje_id: string
  nombre?: string
  tipo_actividad: TipoActividadApi
  fecha_programada: string
  creador: { id: string; nombre: string }
  grupo_origen?: { id: string; nombre: string } | null
  created_at: string
}

export type ViajeParticipanteApi = {
  usuario: { id: string; nombre: string; email: string }
  estado: 'pendiente' | 'confirmado' | 'rechazado'
  origen: 'creador' | 'qr' | 'link' | 'grupo'
  created_at: string
}

export type UnirseQrViajeResponse = {
  viajeId: string
  yaEraParticipante: boolean
}

export async function crearViaje(
  input: {
    nombre: string
    esGrupal: boolean
    grupoIds?: string[]
    tipoActividad: TipoActividadApi
    fechaProgramada: Date
  },
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeCreadoApi> {
  const res = await meshFetch(apiUrl('/api/viajes', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify({
      nombre: input.nombre,
      esGrupal: input.esGrupal,
      grupoIds: input.grupoIds ?? [],
      tipoActividad: input.tipoActividad,
      fechaProgramada: input.fechaProgramada.toISOString(),
    }),
  })
  return parseJson<ViajeCreadoApi>(res)
}

export async function listarViajesPlanificados(
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajePlanificadoApi[]> {
  const res = await meshFetch(apiUrl('/api/viajes/planificados', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajePlanificadoApi[]>(res)
}

export async function listarInvitacionesViajePendientes(
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<InvitacionViajePendienteApi[]> {
  const res = await meshFetch(apiUrl('/api/viajes/invitaciones/pendientes', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<InvitacionViajePendienteApi[]>(res)
}

export async function responderInvitacionViaje(
  viajeId: string,
  accion: 'aceptar' | 'rechazar',
  userId: string,
  baseUrl: string = API_BASE_URL
) {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/invitacion/responder`, baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify({ accion }),
  })
  return parseJson<{ viaje_id: string; accion: string }>(res)
}

export async function listarParticipantesViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeParticipanteApi[]> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/participantes`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeParticipanteApi[]>(res)
}

export async function unirseViajePorQr(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<UnirseQrViajeResponse> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/unirse-qr`, baseUrl), {
    method: 'POST',
    headers: await authHeaders(userId),
  })
  return parseJson<UnirseQrViajeResponse>(res)
}

export type ViajeDetalleApi = {
  id: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
  fecha_programada: string
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  created_at: string
  creador: { id: string; nombre: string; email: string }
  ruta: { id: string; distancia_planeada_m: number | null } | null
  mi_participacion: { estado: string; origen: string } | null
}

export async function obtenerViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeDetalleApi> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeDetalleApi>(res)
}

export type ViajeIniciadoApi = {
  id: string
  creador_id: string
  estado: string
  fecha_inicio_real: string | null
}

export async function iniciarViajeEnBackend(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeIniciadoApi> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/iniciar`, baseUrl), {
    method: 'POST',
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeIniciadoApi>(res)
}

export async function guardarRutaEnBackend(
  viajeId: string,
  userId: string,
  body: PutRutaBody,
  baseUrl: string = API_BASE_URL
): Promise<unknown> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/ruta`, baseUrl), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* usar texto crudo */
    }
    throw new Error(msg || `HTTP ${res.status}`)
  }

  return text ? JSON.parse(text) : null
}

