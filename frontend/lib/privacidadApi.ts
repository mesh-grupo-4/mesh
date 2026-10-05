import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

export type PrivacidadUsuarioApi = {
  comparte_ubicacion_default: boolean
  consentimiento_otorgado: boolean
  /** `false` si aceptó una versión anterior del texto: hay que volver a pedirlo. */
  consentimiento_vigente: boolean
  consentimiento_at: string | null
  consentimiento_version: string | null
  version_vigente: string
  ventana_registro_accesos_min: number
}

export type PrivacidadViajeApi = {
  viaje_id: string
  /** Elección explícita para este viaje; `null` = vale el default del perfil. */
  comparte_ubicacion: boolean | null
  /** Lo que realmente pasa: puede ser false por falta de consentimiento. */
  comparte_efectivo: boolean
  consentimiento_otorgado: boolean
  actualizado_en: string | null
}

export type AccesoUbicacionApi = {
  observador_id: string
  observador_nombre: string
  primera_vez: string
  ultima_vez: string
  veces: number
}

export type AccesoUbicacionGlobalApi = AccesoUbicacionApi & {
  viaje_id: string
  viaje_nombre: string | null
  viaje_fecha: string
}

export async function obtenerMiPrivacidad(): Promise<PrivacidadUsuarioApi> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/privacidad'))
  return parseJson<PrivacidadUsuarioApi>(res)
}

export async function actualizarMiPrivacidad(body: {
  comparte_ubicacion_default?: boolean
  consentimiento_ubicacion?: boolean
}): Promise<PrivacidadUsuarioApi> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/privacidad'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<PrivacidadUsuarioApi>(res)
}

export async function listarMisAccesosUbicacion(): Promise<AccesoUbicacionGlobalApi[]> {
  const res = await meshFetchAuthed(apiUrl('/api/usuarios/me/accesos-ubicacion'))
  return parseJson<AccesoUbicacionGlobalApi[]>(res)
}

export async function obtenerPrivacidadViaje(viajeId: string): Promise<PrivacidadViajeApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/privacidad`))
  return parseJson<PrivacidadViajeApi>(res)
}

export async function actualizarPrivacidadViaje(
  viajeId: string,
  comparteUbicacion: boolean
): Promise<PrivacidadViajeApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/privacidad`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comparte_ubicacion: comparteUbicacion }),
  })
  return parseJson<PrivacidadViajeApi>(res)
}

export async function listarAccesosUbicacionViaje(
  viajeId: string
): Promise<AccesoUbicacionApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/accesos-ubicacion`))
  return parseJson<AccesoUbicacionApi[]>(res)
}

/**
 * Registra el consentimiento informado de geolocalización (RN-110). Se llama en el
 * mismo gesto con el que la persona acepta el permiso de GPS, que es donde la app
 * explica para qué se usa la ubicación.
 *
 * No propaga el error: si falla la red, el viaje arranca igual y el backend
 * simplemente no publica la posición hasta que el consentimiento quede registrado
 * (el próximo intento lo reintenta). Romper el inicio del viaje por esto sería peor.
 */
export async function registrarConsentimientoUbicacion(): Promise<void> {
  try {
    await actualizarMiPrivacidad({ consentimiento_ubicacion: true })
  } catch (e) {
    console.warn('[privacidad] no se pudo registrar el consentimiento de ubicación:', e)
  }
}
