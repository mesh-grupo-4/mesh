import { API_BASE_URL } from '@/constants/Config'
import type { PutRutaBody } from './viajesTypes'

export type ViajeDetalleApi = {
  id: string
  creador_id: string
  es_grupal: boolean
  grupo_id: string | null
  tipo_actividad: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
  fecha_programada: string
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  created_at: string
  creador: { id: string; nombre: string; email: string }
  ruta: { id: string; distancia_planeada_m: number | null } | null
}

async function parseJson<T>(res: Response): Promise<T> {
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

export async function obtenerViaje(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeDetalleApi> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/viajes/${viajeId}`, {
    headers: { 'x-user-id': userId },
  })
  return parseJson<ViajeDetalleApi>(res)
}

export type ViajeIniciadoApi = {
  id: string
  creador_id: string
  estado: string
  fecha_inicio_real: string | null
}

export async function iniciarViajeEnBackend(
  viajeId: string,
  userId: string,
  baseUrl: string = API_BASE_URL
): Promise<ViajeIniciadoApi> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/viajes/${viajeId}/iniciar`, {
    method: 'POST',
    headers: { 'x-user-id': userId },
  })
  return parseJson<ViajeIniciadoApi>(res)
}

export async function guardarRutaEnBackend(
  viajeId: string,
  userId: string,
  body: PutRutaBody,
  baseUrl: string = API_BASE_URL
): Promise<unknown> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/viajes/${viajeId}/ruta`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* usar texto crudo */
    }
    throw new Error(msg || `HTTP ${res.status}`)
  }

  return text ? JSON.parse(text) : null
}
