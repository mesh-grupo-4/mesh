import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-041: temas que el líder elige al crear la alerta. */
export type TipoAlertaApi = 'parada' | 'combustible' | 'desvio' | 'peligro' | 'informacion' | 'atraso'

export type OrigenAlertaApi = 'lider' | 'integrante' | 'sistema'

export type AlertaApi = {
  id: string
  viaje_id: string
  creada_por_id: string | null
  creada_por_nombre: string | null
  tipo: TipoAlertaApi
  origen: OrigenAlertaApi
  mensaje: string | null
  lat: number | null
  lng: number | null
  estado: 'activa' | 'pausada' | 'cancelada' | 'resuelta'
  created_at: string
}

export async function crearAlerta(
  viajeId: string,
  input: { tipo: TipoAlertaApi; mensaje?: string; lat?: number; lng?: number }
): Promise<AlertaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/alertas`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<AlertaApi>(res)
}

export type EstadoAlertaApi = AlertaApi['estado']

/** RN-042: pausar / reactivar / cancelar / resolver. Solo el líder, viaje en curso. */
export async function cambiarEstadoAlerta(
  viajeId: string,
  alertaId: string,
  estado: EstadoAlertaApi
): Promise<AlertaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/alertas/${alertaId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
  return parseJson<AlertaApi>(res)
}

/** Transiciones que el líder puede pedir desde la UI (espejo de `alertas.service.ts`). */
export const TRANSICIONES_ALERTA: Record<EstadoAlertaApi, EstadoAlertaApi[]> = {
  activa: ['pausada', 'resuelta', 'cancelada'],
  pausada: ['activa', 'cancelada'],
  cancelada: [],
  resuelta: [],
}

export const ETIQUETA_ESTADO_ALERTA: Record<EstadoAlertaApi, string> = {
  activa: 'Activa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
  resuelta: 'Resuelta',
}

export const ACCION_ESTADO_ALERTA: Record<EstadoAlertaApi, string> = {
  activa: 'Reactivar',
  pausada: 'Pausar',
  cancelada: 'Cancelar',
  resuelta: 'Resolver',
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
  { id: 'atraso', label: 'Atraso', emoji: '🐢', color: '#ea580c' },
  { id: 'peligro', label: 'Peligro', emoji: '⚠', color: '#dc2626' },
  { id: 'informacion', label: 'Información', emoji: 'ℹ', color: '#6b7280' },
]

/** RN-041: mensajes predeterminados editables al elegir el tipo. */
export const MENSAJE_PREDETERMINADO: Record<TipoAlertaApi, string> = {
  parada: 'Paramos un rato más adelante.',
  combustible: 'Paramos en la próxima estación de servicio.',
  desvio: 'Tomamos un desvío por esta zona.',
  peligro: 'Atención: hay un peligro en el camino.',
  informacion: 'Aviso para el grupo.',
  atraso: 'Vamos con atraso, ajusten el ritmo.',
}

export function metaTipoAlerta(tipo: TipoAlertaApi) {
  return TIPOS_ALERTA.find((t) => t.id === tipo) ?? TIPOS_ALERTA[4]!
}

/** Oculta el prefijo interno `[afectado:uuid]` de alertas del motor de eventos. */
export function mensajeAlertaVisible(mensaje: string | null): string | null {
  if (!mensaje) return null
  const limpio = mensaje.replace(/^\[afectado:[0-9a-f-]+\]\s*/i, '').trim()
  return limpio || null
}

export function usuarioAfectadoDesdeMensaje(mensaje: string | null): string | null {
  if (!mensaje) return null
  const m = mensaje.match(/^\[afectado:([0-9a-f-]+)\]/i)
  return m?.[1] ?? null
}
