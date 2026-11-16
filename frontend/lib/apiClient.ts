import { API_BASE_URL, DEV_USER_ID } from '@/constants/Config'
import { auth } from '@/lib/firebase'

const FETCH_TIMEOUT_MS = 12_000

export class MeshApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** RN-030c: viaje en curso que impide iniciar otro (`OTRO_VIAJE_EN_CURSO`). */
    public readonly viajeEnCursoId?: string
  ) {
    super(message)
    this.name = 'MeshApiError'
  }
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string> {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) {
    throw new Error('No hay sesión activa. Iniciá sesión nuevamente.')
  }
  return user.getIdToken(forceRefresh)
}

export async function bearerAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const token = await getFirebaseIdToken(forceRefresh)
  return { Authorization: `Bearer ${token}` }
}

/** Fetch autenticado con reintento automático si el token expiró (401). */
export async function meshFetchAuthed(url: string, init?: RequestInit): Promise<Response> {
  const attempt = async (forceRefresh: boolean) =>
    meshFetch(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        ...(await bearerAuthHeaders(forceRefresh)),
      },
    })

  const res = await attempt(false)
  if (res.status === 401) return attempt(true)
  return res
}

export function isAuthApiError(error: unknown): boolean {
  return error instanceof MeshApiError && error.status === 401
}

export async function meshFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('No pudimos conectar con el servidor. Revisá tu conexión y reintentá.')
    }
    // fetch sin red rechaza con un TypeError en inglés ("Network request failed").
    if (e instanceof TypeError) {
      throw new Error('No pudimos conectar con el servidor. Revisá tu conexión y reintentá.')
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
    let viajeEnCursoId: string | undefined
    try {
      const j = JSON.parse(text) as { error?: string; code?: string; viaje_en_curso_id?: string }
      if (j.error) msg = j.error
      code = j.code
      viajeEnCursoId = j.viaje_en_curso_id
    } catch {
      /* */
    }
    throw new MeshApiError(res.status, msg || `HTTP ${res.status}`, code, viajeEnCursoId)
  }
  return text ? (JSON.parse(text) as T) : (null as T)
}

export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export function authHeaders(_userId?: string): Promise<Record<string, string>> {
  return bearerAuthHeaders()
}

export { meshFetchAuthed as meshFetchWithAuth }

export function resolveBackendUserId(
  backendUserId: string | null | undefined
): string {
  if (backendUserId) return backendUserId
  if (DEV_USER_ID) return DEV_USER_ID
  throw new Error('No hay usuario de backend sincronizado. Volvé a iniciar sesión.')
}
