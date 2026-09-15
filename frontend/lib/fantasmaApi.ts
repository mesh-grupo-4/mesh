import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'
import type { TipoActividadApi } from './viajesApi'

/** RN-073: ghost tracking. Espejo de `CandidatoFantasma` / `Fantasma` del spec. */
export type CandidatoFantasmaApi = {
  tipo: 'viaje' | 'plantilla'
  ref: string
  viaje_id: string | null
  usuario_id: string | null
  plantilla_id: string | null
  nombre: string
  autor: string
  es_propio: boolean
  tipo_actividad: TipoActividadApi
  fecha: string | null
  distancia_m: number | null
  duracion_seg: number | null
}

export type PuntoFantasmaApi = { t_seg: number; lat: number; lng: number; d_m: number }

export type FantasmaApi = {
  tipo: 'viaje' | 'plantilla'
  ref: string
  nombre: string
  autor: string
  tipo_actividad: TipoActividadApi
  distancia_m: number
  duracion_seg: number
  interpolado: boolean
  puntos: PuntoFantasmaApi[]
}

export async function listarCandidatosFantasma(viajeId: string): Promise<CandidatoFantasmaApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/fantasma/candidatos`))
  return parseJson<CandidatoFantasmaApi[]>(res)
}

/** `ref` con la forma `viaje:<viajeId>:<usuarioId>` o `plantilla:<id>`. */
export async function obtenerFantasma(viajeId: string, ref: string): Promise<FantasmaApi> {
  const partes = ref.split(':')
  const q = new URLSearchParams()
  if (partes[0] === 'plantilla' && partes[1]) q.set('plantillaId', partes[1])
  else if (partes[0] === 'viaje' && partes[1]) {
    q.set('viajeRef', partes[1])
    if (partes[2]) q.set('usuarioRef', partes[2])
  }
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/fantasma?${q.toString()}`))
  return parseJson<FantasmaApi>(res)
}
