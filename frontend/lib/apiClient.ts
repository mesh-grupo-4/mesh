import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import Constants from 'expo-constants'
import { auth } from '@/lib/firebase'

const FETCH_TIMEOUT_MS = 12_000

export class MeshApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'MeshApiError'
  }
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('No hay sesión activa. Iniciá sesión nuevamente.')
  }
  return user.getIdToken()
}

export async function bearerAuthHeaders(): Promise<Record<string, string>> {
  const token = await getFirebaseIdToken()
  return { Authorization: `Bearer ${token}` }
}

export async function meshFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      const hint =
        Constants.isDevice && API_BASE_URL.includes('localhost')
          ? ' En el celular, localhost no funciona: definí EXPO_PUBLIC_API_URL con la IP de tu PC (puerto 3000) o usá ngrok si estás en modo túnel.'
          : ' Verificá que el backend esté corriendo (npm run dev), que iPhone y PC estén en la misma Wi‑Fi y que el firewall permita el puerto 3000.';
      throw new Error(`Tiempo de espera agotado al conectar con ${API_BASE_URL}.${hint}`)
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
    let code: string | undefined
    try {
      const j = JSON.parse(text) as { error?: string; code?: string }
      if (j.error) msg = j.error
      code = j.code
    } catch {
      /* */
    }
    throw new MeshApiError(res.status, msg || `HTTP ${res.status}`, code)
  }
  return text ? (JSON.parse(text) as T) : (null as T)
}

export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export function authHeaders(_userId?: string): Promise<Record<string, string>> {
  return bearerAuthHeaders()
}

export function resolveBackendUserId(
  backendUserId: string | null | undefined
): string {
  if (backendUserId) return backendUserId
  if (DEV_USER_ID) return DEV_USER_ID
  throw new Error('No hay usuario de backend sincronizado. Volvé a iniciar sesión.')
}
