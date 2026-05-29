import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'

const FETCH_TIMEOUT_MS = 12_000

export async function meshFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al conectar con ${API_BASE_URL}`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* */
    }
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return text ? (JSON.parse(text) as T) : (null as T)
}

export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export function authHeaders(userId: string): Record<string, string> {
  return { 'x-user-id': userId }
}

export function resolveBackendUserId(
  backendUserId: string | null | undefined
): string {
  if (backendUserId) return backendUserId
  if (DEV_USER_ID) return DEV_USER_ID
  throw new Error('No hay usuario de backend sincronizado. Volvé a iniciar sesión.')
}
