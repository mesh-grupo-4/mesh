import { API_BASE_URL } from '@/constants/Config'
import type { PutRutaBody, RutaDetalleApi } from './viajesTypes'
import { apiUrl, authHeaders, meshFetch, parseJson } from './apiClient'

export type TipoActividadApi = 'moto' | 'bici' | 'running' | 'trekking'

export type ViajeCreadoApi = {
  id: string
  nombre?: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: TipoActividadApi
  velocidad_esperada: number
  distancia_max_separacion: number
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
  velocidad_esperada: number
  distancia_max_separacion: number
  fecha_programada: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
  mi_estado: 'creador' | 'confirmado' | 'pendiente' | 'rechazado' | null
}

export type ViajeFinalizadoApi = {
  id: string
  nombre?: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: TipoActividadApi
  velocidad_esperada: number
  distancia_max_separacion: number
  fecha_programada: string
  fecha_fin_real: string | null
  estado: 'finalizado'
  mi_estado: 'creador' | 'confirmado' | null
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
  origen: 'creador' | 'qr' | 'link' | 'grupo' | 'amigo'
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
    amigoIds?: string[]
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
      amigoIds: input.amigoIds ?? [],
      tipoActividad: input.tipoActividad,
      fechaProgramada: input.fechaProgramada.toISOString(),
    }),
  })
  return parseJson<ViajeCreadoApi>(res)
}

export type ViajeEnCursoApi = {
  id: string
  nombre?: string | null
  tipo_actividad: TipoActividadApi
  fecha_inicio_real: string | null
  soy_creador: boolean
}

export type EstadisticasUsuarioApi = {
  viajes_finalizados: number
  distancia_total_m: number
  tiempo_total_seg: number
  actividad_favorita: TipoActividadApi | null
}

export async function obtenerViajeEnCurso(
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeEnCursoApi | null> {
  const res = await meshFetch(apiUrl('/api/viajes/en-curso', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeEnCursoApi | null>(res)
}

export async function obtenerEstadisticasUsuario(
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<EstadisticasUsuarioApi> {
  const res = await meshFetch(apiUrl('/api/viajes/estadisticas', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<EstadisticasUsuarioApi>(res)
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

export async function listarViajesFinalizados(
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeFinalizadoApi[]> {
  const res = await meshFetch(apiUrl('/api/viajes/finalizados', baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeFinalizadoApi[]>(res)
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
  nombre?: string | null
  es_grupal: boolean
  tipo_actividad: string
  velocidad_esperada: number
  distancia_max_separacion: number
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

export type ViajeActualizadoApi = {
  id: string
  fecha_programada: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
}

export async function actualizarFechaViaje(
  viajeId: string,
  userId: string,
  fechaProgramada: Date,
  baseUrl: string = API_BASE_URL
): Promise<ViajeActualizadoApi> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}`, baseUrl), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify({ fechaProgramada: fechaProgramada.toISOString() }),
  })
  return parseJson<ViajeActualizadoApi>(res)
}

export type ViajeIniciadoApi = {
  id: string
  creador_id: string
  nombre?: string | null
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

export type EliminarViajeResponse = {
  viaje_id: string
  accion: 'eliminado'
}

export async function eliminarViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<EliminarViajeResponse> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}`, baseUrl), {
    method: 'DELETE',
    headers: await authHeaders(userId),
  })
  return parseJson<EliminarViajeResponse>(res)
}

export type ViajeFinalizadoBackendApi = {
  id: string
  estado: string
  fecha_fin_real: string | null
}

export async function finalizarViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeFinalizadoBackendApi> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/finalizar`, baseUrl), {
    method: 'POST',
    headers: await authHeaders(userId),
  })
  return parseJson<ViajeFinalizadoBackendApi>(res)
}

export type SalirViajeResponse = {
  viaje_id: string
  accion: 'salido'
}

export async function salirViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<SalirViajeResponse> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/salir`, baseUrl), {
    method: 'POST',
    headers: await authHeaders(userId),
  })
  return parseJson<SalirViajeResponse>(res)
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

export async function obtenerRuta(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<RutaDetalleApi | null> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/ruta`, baseUrl), {
    method: 'GET',
    headers: await authHeaders(userId),
  })

  if (res.status === 404) {
    return null
  }

  return parseJson<RutaDetalleApi>(res)
}

export type UbicacionVivaSnapshotApi = {
  usuarioId: string
  viajeId: string
  lat: number
  lng: number
  precision: number | null
  updatedAt: string
  nombre: string
}

export async function upsertUbicacionViva(
  viajeId: string,
  userId: string,
  body: { lat: number; lng: number; precision?: number | null; recordedAt: string },
  baseUrl: string = API_BASE_URL
): Promise<void> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/ubicacion-viva`, baseUrl), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(userId)),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}

export async function listarUbicacionesVivas(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<UbicacionVivaSnapshotApi[]> {
  const res = await meshFetch(apiUrl(`/api/viajes/${viajeId}/ubicaciones-vivas`, baseUrl), {
    headers: await authHeaders(userId),
  })
  return parseJson<UbicacionVivaSnapshotApi[]>(res)
}

