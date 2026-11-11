import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { TipoActividadApi } from './viajesApi'

/** RN-065 / RN-070: actividades con modo entrenamiento (moto y auto no lo tienen). */
export type ActividadEntrenableApi = Exclude<TipoActividadApi, 'moto' | 'auto'>

/** RN-066: qué recorrido de la sesión original usa la repetición. */
export type RecorridoRepeticionApi = 'planificado' | 'real'

/** RN-066: una sesión de entrenamiento propia (viaje finalizado en modo entrenamiento). */
export type SesionApi = {
  viaje_id: string
  nombre: string
  tipo_actividad: ActividadEntrenableApi
  fecha_fin_real: string | null
  es_creador: boolean
  distancia_m: number
  tiempo_movimiento_seg: number
  velocidad_promedio_kmh: number | null
  pace_min_km: number | null
  circuito: { id: string; nombre: string } | null
  /** Qué recorridos se pueden ofrecer al repetirla. */
  repetir: { planificado: boolean; real: boolean }
}

export type SesionCircuitoApi = {
  viaje_id: string
  nombre: string
  fecha_fin_real: string | null
  distancia_m: number
  tiempo_movimiento_seg: number
  pace_min_km: number | null
}

/** RN-066: circuito propio (sesiones de un mismo recorrido) con su evolución. */
export type CircuitoApi = {
  id: string
  nombre: string
  tipo_actividad: ActividadEntrenableApi
  ruta_plantilla_id: string | null
  total_sesiones: number
  mejor_pace_min_km: number | null
  mejor_distancia_m: number | null
  /** La sesión más reciente: es la que se repite desde la tarjeta del circuito. */
  ultima_sesion_viaje_id: string | null
  ultima_sesion_fecha: string | null
  /** Últimas 6 sesiones, de la más vieja a la más nueva. */
  evolucion: SesionCircuitoApi[]
}

function conQuery(path: string, params: Record<string, string | undefined | null>): string {
  const q = Object.entries(params)
    .filter((e): e is [string, string] => Boolean(e[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return q ? `${path}?${q}` : path
}

export async function listarSesiones(
  filtros: { tipoActividad?: ActividadEntrenableApi | null; circuitoId?: string | null } = {}
): Promise<SesionApi[]> {
  const res = await meshFetchAuthed(apiUrl(conQuery('/api/entrenamientos/sesiones', filtros)))
  return parseJson<SesionApi[]>(res)
}

export async function obtenerSesion(viajeId: string): Promise<SesionApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/entrenamientos/sesiones/${viajeId}`))
  return parseJson<SesionApi>(res)
}

export async function listarCircuitos(
  filtros: { tipoActividad?: ActividadEntrenableApi | null } = {}
): Promise<CircuitoApi[]> {
  const res = await meshFetchAuthed(apiUrl(conQuery('/api/entrenamientos/circuitos', filtros)))
  return parseJson<CircuitoApi[]>(res)
}

export async function renombrarCircuito(circuitoId: string, nombre: string): Promise<void> {
  const res = await meshFetchAuthed(apiUrl(`/api/entrenamientos/circuitos/${circuitoId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  await parseJson<unknown>(res)
}

export async function sacarSesionDeCircuito(circuitoId: string, viajeId: string): Promise<void> {
  const res = await meshFetchAuthed(
    apiUrl(`/api/entrenamientos/circuitos/${circuitoId}/sesiones/${viajeId}`),
    { method: 'DELETE' }
  )
  await parseJson<unknown>(res)
}
