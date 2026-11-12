import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-034b: estado del desvío del grupo, que marca el líder al salir de la ruta. */
export type EstadoDesvioGrupal = 'ninguno' | 'pendiente' | 'rechazado' | 'recalculando'

export type DesvioGrupalApi = {
  estado: EstadoDesvioGrupal
  desde: string | null
  /** Solo con `pendiente`: cuándo se recalcula sola la ruta si el líder no responde. */
  recalculo_automatico_en: string | null
}

export type RutaRecalculadaApi = {
  linestring: { type: 'LineString'; coordinates: [number, number][] }
  distancia_planeada_m: number
  tiempo_estimado_seg: number | null
  paradas_pendientes: number
}

/** Payload de `viaje:ruta_actualizada`. */
export type RutaActualizadaEvento = {
  viajeId: string
  motivo: 'lider' | 'automatico' | 'edicion'
  linestring: { type: 'LineString'; coordinates: [number, number][] }
  distanciaPlaneadaM: number
  tiempoEstimadoSeg: number | null
  recalculadaEn: string
}

export async function obtenerDesvioGrupal(viajeId: string): Promise<DesvioGrupalApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/desvio-grupal`))
  return parseJson<DesvioGrupalApi>(res)
}

/** Solo el líder: el grupo tomó otro camino, recalcular la ruta desde su posición. */
export async function confirmarDesvioGrupal(viajeId: string): Promise<RutaRecalculadaApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/desvio-grupal/confirmar`), {
    method: 'POST',
  })
  return parseJson<RutaRecalculadaApi>(res)
}

/** Solo el líder: vuelven a la ruta, no recalcular. */
export async function rechazarDesvioGrupal(viajeId: string): Promise<DesvioGrupalApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/desvio-grupal/rechazar`), {
    method: 'POST',
  })
  return parseJson<DesvioGrupalApi>(res)
}

/** Participante: avisa que se desvía a propósito; cierra su alerta de desvío. */
export async function avisarDesvioVoluntario(viajeId: string): Promise<void> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/desvio/voluntario`), {
    method: 'POST',
  })
  await parseJson<null>(res)
}
