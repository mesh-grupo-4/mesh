import { apiUrl, meshFetch, parseJson } from './apiClient'

export type SyncUsuarioResponse = {
  id: string
  email: string
  nombre: string
}

export async function syncUsuario(
  email: string,
  nombre: string,
  baseUrl?: string
): Promise<SyncUsuarioResponse> {
  const res = await meshFetch(apiUrl('/api/usuarios/sync', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nombre }),
  })
  return parseJson<SyncUsuarioResponse>(res)
}
