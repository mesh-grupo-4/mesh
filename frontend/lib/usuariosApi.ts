import { apiUrl, bearerAuthHeaders, meshFetch, parseJson } from './apiClient'

export type ActividadPreferidaApi = 'moto' | 'bici' | 'running' | 'trekking'

export type UsuarioPerfilResponse = {
  id: string
  email: string
  nombre: string
  apellido: string | null
  telefono: string | null
  actividad_preferida: ActividadPreferidaApi | null
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
  const res = await meshFetch(apiUrl('/api/usuarios/sync', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await bearerAuthHeaders()),
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
    await meshFetch(apiUrl('/api/usuarios/push-token'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(await bearerAuthHeaders()),
      },
      body: JSON.stringify({ token }),
    })
  } catch (e) {
    console.warn('[Push] No se pudo registrar el token:', e)
  }
}

// Lee el perfil del usuario autenticado directamente desde la base de datos.
export async function obtenerMiPerfil(baseUrl?: string): Promise<UsuarioPerfilResponse> {
  const res = await meshFetch(apiUrl('/api/usuarios/me', baseUrl), {
    method: 'GET',
    headers: {
      ...(await bearerAuthHeaders()),
    },
  })
  return parseJson<UsuarioPerfilResponse>(res)
}
