import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

export type GastoParticipanteApi = { usuario_id: string; nombre: string }

export type GastoApi = {
  id: string
  viaje_id: string
  usuario_id: string
  usuario_nombre: string
  monto: number
  descripcion: string
  participantes: GastoParticipanteApi[]
  monto_por_persona: number
  /** El backend decide (RN-030): solo quien lo registró puede editarlo o borrarlo. */
  puede_editar: boolean
  created_at: string
}

export type SaldoIntegranteGastoApi = {
  usuario_id: string
  nombre: string
  pagado: number
  debe: number
  saldo: number
}

export type TransaccionLiquidacionApi = {
  de_id: string
  de_nombre: string
  para_id: string
  para_nombre: string
  monto: number
}

export type BalanceGastosApi = {
  por_persona: SaldoIntegranteGastoApi[]
  transacciones: TransaccionLiquidacionApi[]
}

export async function listarGastos(viajeId: string): Promise<GastoApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/gastos`))
  return parseJson<GastoApi[]>(res)
}

export async function agregarGasto(
  viajeId: string,
  input: { monto: number; descripcion: string; participantesIds: string[] }
): Promise<GastoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/gastos`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<GastoApi>(res)
}

export async function actualizarGasto(
  viajeId: string,
  gastoId: string,
  input: { monto?: number; descripcion?: string; participantesIds?: string[] }
): Promise<GastoApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/gastos/${gastoId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<GastoApi>(res)
}

export async function eliminarGasto(viajeId: string, gastoId: string): Promise<void> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/gastos/${gastoId}`), {
    method: 'DELETE',
  })
  // 204 sin cuerpo: parseJson tolera respuesta vacía y valida el status.
  await parseJson<null>(res)
}

/** Solo disponible una vez que el viaje está `finalizado` (409 antes de eso). */
export async function obtenerBalanceGastos(viajeId: string): Promise<BalanceGastosApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/gastos/balance`))
  return parseJson<BalanceGastosApi>(res)
}
