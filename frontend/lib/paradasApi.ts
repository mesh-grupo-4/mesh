import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-022: categorías de parada. */
export type CategoriaParadaApi =
  | 'kiosco'
  | 'combustible'
  | 'descanso'
  | 'gastronomia'
  | 'punto_control'
  | 'sanitario'
  | 'otro'

/** RN-037: estados visibles de un integrante en el mapa grupal. */
export type EstadoIntegranteApi = 'en_movimiento' | 'detenido_voluntario' | 'posible_incidente'

export type EstadoSolicitudApi = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'

export type ParadaApi = {
  id: string
  viaje_id: string
  usuario_id: string
  lat: number
  lng: number
  categoria: CategoriaParadaApi | null
  inicio: string
  fin: string | null
  duracion_segundos: number | null
}

export type SolicitudParadaApi = {
  id: string
  viaje_id: string
  solicitante_id: string
  solicitante_nombre: string | null
  lat: number | null
  lng: number | null
  motivo: string | null
  estado: EstadoSolicitudApi
  created_at: string
  resolved_at: string | null
}

// -------------------------------------------------------------------- US1/US3

export async function iniciarParada(
  viajeId: string,
  input: { lat: number; lng: number; categoria: CategoriaParadaApi }
): Promise<ParadaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/paradas`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<ParadaApi>(res)
}

export async function finalizarParada(viajeId: string): Promise<ParadaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/paradas/finalizar`), {
    method: 'POST',
  })
  return parseJson<ParadaApi>(res)
}

/** Parada abierta propia; sirve para rehidratar la pantalla al volver a entrar. */
export async function obtenerParadaActiva(viajeId: string): Promise<ParadaApi | null> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/paradas/activa`))
  return parseJson<ParadaApi | null>(res)
}

// ------------------------------------------------------------------------ US2

export async function solicitarParada(
  viajeId: string,
  input: { lat?: number; lng?: number; motivo?: string } = {}
): Promise<SolicitudParadaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/solicitudes-parada`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<SolicitudParadaApi>(res)
}

/** El líder recibe las pendientes del viaje; un participante, solo las suyas. */
export async function listarSolicitudesParada(viajeId: string): Promise<SolicitudParadaApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/solicitudes-parada`))
  return parseJson<SolicitudParadaApi[]>(res)
}

export async function responderSolicitudParada(
  viajeId: string,
  solicitudId: string,
  decision: 'aprobada' | 'rechazada'
): Promise<SolicitudParadaApi> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/viajes/${viajeId}/solicitudes-parada/${solicitudId}/responder`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    }
  )
  return parseJson<SolicitudParadaApi>(res)
}

export async function cancelarSolicitudParada(
  viajeId: string,
  solicitudId: string
): Promise<SolicitudParadaApi> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/viajes/${viajeId}/solicitudes-parada/${solicitudId}/cancelar`),
    { method: 'POST' }
  )
  return parseJson<SolicitudParadaApi>(res)
}

/** Etiquetas y emoji de cada categoría, para el selector y los mensajes. */
export const CATEGORIAS_PARADA: { id: CategoriaParadaApi; label: string; emoji: string }[] = [
  { id: 'combustible', label: 'Combustible', emoji: '⛽' },
  { id: 'descanso', label: 'Descanso', emoji: '☕' },
  { id: 'gastronomia', label: 'Gastronomía', emoji: '🍔' },
  { id: 'sanitario', label: 'Sanitario', emoji: '🚻' },
  { id: 'kiosco', label: 'Kiosco', emoji: '🏪' },
  { id: 'punto_control', label: 'Punto de control', emoji: '📍' },
  { id: 'otro', label: 'Otro', emoji: '⋯' },
]
