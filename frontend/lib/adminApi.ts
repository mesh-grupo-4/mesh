import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { ActividadPreferidaApi } from './usuariosApi'

/**
 * Backoffice superadmin (RN-120 a RN-126). Contrato en
 * `backend/openapi/paths/admin.yaml`. El backend valida el rol en cada llamada.
 */

export type RolSistema = 'usuario' | 'superadmin'
export type EstadoViajeApi = 'planificado' | 'en_curso' | 'finalizado'

export type Pagina<T> = { items: T[]; total: number; pagina: number; limite: number }

export type PersonaAdmin = { id: string; nombre: string; apellido: string | null; email: string }

export type EstadisticasAdmin = {
  usuarios: { total: number; superadmins: number; suspendidos: number }
  grupos: { total: number }
  viajes: Record<EstadoViajeApi | 'total', number>
}

export type UsuarioAdminResumen = PersonaAdmin & {
  rol_sistema: RolSistema
  suspendido_at: string | null
  created_at: string
}

export type UsuarioAdminDetalle = UsuarioAdminResumen & {
  telefono: string | null
  actividad_preferida: ActividadPreferidaApi | null
  motivo_suspension: string | null
  grupos: { id: string; nombre: string; rol: 'lider' | 'participante'; fecha_union: string }[]
  totales: { viajes_creados: number; participaciones_viaje: number; grupos_liderados: number }
}

export type UsuarioEliminado = {
  grupos_transferidos: number
  grupos_eliminados: number
  viajes_transferidos: number
  viajes_eliminados: number
}

export type GrupoAdminResumen = {
  id: string
  nombre: string
  fecha_creacion: string
  lider: PersonaAdmin
  cantidad_miembros: number
}

export type GrupoAdminDetalle = {
  id: string
  nombre: string
  fecha_creacion: string
  lider_id: string
  cantidad_viajes: number
  miembros: (PersonaAdmin & { rol: 'lider' | 'participante'; fecha_union: string })[]
}

export type ViajeAdminResumen = {
  id: string
  nombre: string | null
  tipo_actividad: ActividadPreferidaApi
  es_grupal: boolean
  estado: EstadoViajeApi
  fecha_programada: string
  created_at: string
  creador: PersonaAdmin
  cantidad_integrantes: number
}

export type ViajeAdminDetalle = Omit<ViajeAdminResumen, 'cantidad_integrantes'> & {
  modo: string
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  ruta: {
    origen_nombre: string | null
    destino_nombre: string | null
    distancia_planeada_m: number | null
  } | null
  integrantes: (PersonaAdmin & { estado: string; origen: string; fecha_union: string })[]
  grupos: { id: string; nombre: string }[]
  totales: { alertas: number; paradas: number; gastos: number }
}

export type EntradaAuditoria = {
  id: string
  accion: string
  entidad: 'usuario' | 'grupo' | 'viaje'
  entidad_id: string
  detalle: Record<string, unknown> | null
  created_at: string
  actor: PersonaAdmin | null
}

function query(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

async function get<T>(path: string): Promise<T> {
  return parseJson<T>(await meshFetchAuthed(apiUrl(path)))
}

async function enviar<T>(metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await meshFetchAuthed(apiUrl(path), {
    method: metodo,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseJson<T>(res)
}

export const obtenerEstadisticasAdmin = () => get<EstadisticasAdmin>('/api/admin/estadisticas')

// ── Usuarios ──
export const listarUsuariosAdmin = (p: {
  q?: string
  rol?: RolSistema
  estado?: 'activo' | 'suspendido'
  pagina?: number
}) => get<Pagina<UsuarioAdminResumen>>(`/api/admin/usuarios${query(p)}`)

export const obtenerUsuarioAdmin = (id: string) =>
  get<UsuarioAdminDetalle>(`/api/admin/usuarios/${id}`)

export const cambiarRolSistemaAdmin = (id: string, rol: RolSistema) =>
  enviar<{ id: string; rol_sistema: RolSistema }>('PUT', `/api/admin/usuarios/${id}/rol`, {
    rol_sistema: rol,
  })

export const suspenderUsuarioAdmin = (id: string, motivo: string) =>
  enviar('POST', `/api/admin/usuarios/${id}/suspender`, { motivo })

export const reactivarUsuarioAdmin = (id: string) =>
  enviar('POST', `/api/admin/usuarios/${id}/reactivar`)

export const eliminarUsuarioAdmin = (id: string) =>
  enviar<UsuarioEliminado>('DELETE', `/api/admin/usuarios/${id}`)

// ── Grupos ──
export const listarGruposAdmin = (p: { q?: string; pagina?: number }) =>
  get<Pagina<GrupoAdminResumen>>(`/api/admin/grupos${query(p)}`)

export const obtenerGrupoAdmin = (id: string) => get<GrupoAdminDetalle>(`/api/admin/grupos/${id}`)

export const reasignarLiderAdmin = (grupoId: string, usuarioId: string) =>
  enviar('PUT', `/api/admin/grupos/${grupoId}/lider`, { usuario_id: usuarioId })

export const quitarMiembroAdmin = (grupoId: string, usuarioId: string) =>
  enviar<{ accion: 'quitado' | 'grupo_eliminado' }>(
    'DELETE',
    `/api/admin/grupos/${grupoId}/miembros/${usuarioId}`
  )

export const eliminarGrupoAdmin = (id: string) => enviar('DELETE', `/api/admin/grupos/${id}`)

// ── Viajes ──
export const listarViajesAdmin = (p: { q?: string; estado?: EstadoViajeApi; pagina?: number }) =>
  get<Pagina<ViajeAdminResumen>>(`/api/admin/viajes${query(p)}`)

export const obtenerViajeAdmin = (id: string) => get<ViajeAdminDetalle>(`/api/admin/viajes/${id}`)

export const finalizarViajeAdmin = (id: string) =>
  enviar('POST', `/api/admin/viajes/${id}/finalizar`)

export const eliminarViajeAdmin = (id: string) => enviar('DELETE', `/api/admin/viajes/${id}`)

// ── Auditoría ──
export const listarAuditoriaAdmin = (p: { pagina?: number }) =>
  get<Pagina<EntradaAuditoria>>(`/api/admin/auditoria${query(p)}`)
