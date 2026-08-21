import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-041: temas que el líder elige al crear la alerta. */
export type TipoAlertaApi = 'parada' | 'combustible' | 'desvio' | 'peligro' | 'informacion'

export type AlertaApi = {
  id: string
  viaje_id: string
  creada_por_id: string | null
  creada_por_nombre: string | null
  tipo: TipoAlertaApi
  origen: 'lider' | 'sistema'
  mensaje: string
  lat: number | null
  lng: number | null
  estado: 'activa' | 'pausada' | 'cancelada' | 'resuelta'
  created_at: string
}

export async function crearAlerta(
  viajeId: string,
  input: { tipo: TipoAlertaApi; mensaje: string; lat?: number; lng?: number }
): Promise<AlertaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/alertas`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<AlertaApi>(res)
}

/** Historial del viaje, más reciente primero. */
export async function listarAlertas(viajeId: string): Promise<AlertaApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/alertas`))
  return parseJson<AlertaApi[]>(res)
}

export const TIPOS_ALERTA: {
  id: TipoAlertaApi
  label: string
  emoji: string
  color: string
}[] = [
  { id: 'parada', label: 'Parada', emoji: '⏸', color: '#f59e0b' },
  { id: 'combustible', label: 'Combustible', emoji: '⛽', color: '#0ea5e9' },
  { id: 'desvio', label: 'Desvío', emoji: '↗', color: '#8b5cf6' },
  { id: 'peligro', label: 'Peligro', emoji: '⚠', color: '#dc2626' },
  { id: 'informacion', label: 'Información', emoji: 'ℹ', color: '#6b7280' },
]

export function metaTipoAlerta(tipo: TipoAlertaApi) {
  return TIPOS_ALERTA.find((t) => t.id === tipo) ?? TIPOS_ALERTA[4]!
}
