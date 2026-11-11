import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { RelacionAmistad } from './amistadesApi'
import type { InsigniaObtenidaApi } from './insigniasApi'
import type { RachaApi } from './rachasApi'
import type { VisibilidadLogrosApi } from './privacidadApi'
import type { EstadisticasUsuarioApi } from './viajesApi'

export type ActividadPreferidaApi = 'moto' | 'auto' | 'bici' | 'running' | 'trekking' | 'otro'

export type UsuarioPerfilResponse = {
  id: string
  email: string
  nombre: string
  apellido: string | null
  telefono: string | null
  actividad_preferida: ActividadPreferidaApi | null
  /** RN-120: rol de plataforma. Solo orienta la UI; el backend valida cada acción. */
  rol_sistema: 'usuario' | 'superadmin'
  /** URL pública de la foto de perfil. Null = iniciales. */
  foto_perfil: string | null
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

/**
 * Perfil de un usuario de la comunidad: sin email ni teléfono. Los logros vienen
 * en `null` si la persona no los comparte con quien consulta (RN-077).
 */
export type PerfilPublicoApi = {
  id: string
  nombre: string
  apellido: string | null
  actividad_preferida: ActividadPreferidaApi | null
  foto_perfil: string | null
  es_yo: boolean
  relacion_amistad: RelacionAmistad
  visibilidad_logros: VisibilidadLogrosApi
  logros_visibles: boolean
  racha: RachaApi | null
  estadisticas: EstadisticasUsuarioApi | null
  insignias: InsigniaObtenidaApi[] | null
}

export async function obtenerPerfilPublico(
  usuarioId: string,
  baseUrl?: string
): Promise<PerfilPublicoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/usuarios/${usuarioId}/perfil`, baseUrl))
  return parseJson<PerfilPublicoApi>(res)
}

// ── Foto de perfil (Supabase Storage) ───────────────────────────────────────

export type SubidaFotoApi = { path: string; upload_url: string }

/** Paso 1: el backend elige la ruta y devuelve una URL firmada para subir el JPEG. */
export async function crearSubidaFoto(): Promise<SubidaFotoApi> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/foto/subida'), { method: 'POST' })
  return parseJson<SubidaFotoApi>(res)
}

/** Paso 3: el backend verifica el archivo subido y lo guarda como foto de perfil. */
export async function confirmarFoto(path: string): Promise<{ foto_perfil: string }> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/foto'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return parseJson<{ foto_perfil: string }>(res)
}

export async function eliminarFoto(): Promise<void> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/foto'), { method: 'DELETE' })
  await parseJson<{ foto_perfil: null }>(res)
}

/** Fotos de hasta 200 usuarios: solo vuelven los que tienen. */
export async function consultarFotos(ids: string[]): Promise<Record<string, string>> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/fotos'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  const data = await parseJson<{ fotos: Record<string, string> }>(res)
  return data.fotos
}
