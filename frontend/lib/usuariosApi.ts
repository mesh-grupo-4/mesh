import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { RelacionAmistad } from './amistadesApi'
import type { InsigniaObtenidaApi } from './insigniasApi'
import type { RachaApi } from './rachasApi'
import type { EstadisticasUsuarioApi } from './viajesApi'

export type ActividadPreferidaApi = 'moto' | 'bici' | 'running' | 'trekking' | 'otro'

export type UsuarioPerfilResponse = {
  id: string
  email: string
  nombre: string
  apellido: string | null
  telefono: string | null
  actividad_preferida: ActividadPreferidaApi | null
  /** RN-120: rol de plataforma. Solo orienta la UI; el backend valida cada acción. */
  rol_sistema: 'usuario' | 'superadmin'
}

export type SyncUsuarioInput = {
  email: string
  nombre: string
  apellido?: string | null
  telefono?: string | null
  actividadPreferida?: ActividadPreferidaApi | null
}

export async function syncUsuario(
  input: SyncUsuarioInput,
  baseUrl?: string
): Promise<UsuarioPerfilResponse> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/sync', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      nombre: input.nombre,
      apellido: input.apellido ?? null,
      telefono: input.telefono ?? null,
      actividad_preferida: input.actividadPreferida ?? null,
    }),
  })
  return parseJson<UsuarioPerfilResponse>(res)
}

export async function registrarPushToken(token: string): Promise<void> {
  try {
    await meshFetchAuthed(apiUrl('/api/usuarios/push-token'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
  } catch (e) {
    console.warn('[Push] No se pudo registrar el token:', e)
  }
}

// Lee el perfil del usuario autenticado directamente desde la base de datos.
export async function obtenerMiPerfil(baseUrl?: string): Promise<UsuarioPerfilResponse> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me', baseUrl), {
    method: 'GET',
  })
  return parseJson<UsuarioPerfilResponse>(res)
}

/** Perfil visible para cualquier usuario de la comunidad (RN-074): sin email ni teléfono. */
export type PerfilPublicoApi = {
  id: string
  nombre: string
  apellido: string | null
  actividad_preferida: ActividadPreferidaApi | null
  es_yo: boolean
  relacion_amistad: RelacionAmistad
  racha: RachaApi
  estadisticas: EstadisticasUsuarioApi
  insignias: InsigniaObtenidaApi[]
}

export async function obtenerPerfilPublico(
  usuarioId: string,
  baseUrl?: string
): Promise<PerfilPublicoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/usuarios/${usuarioId}/perfil`, baseUrl))
  return parseJson<PerfilPublicoApi>(res)
}
