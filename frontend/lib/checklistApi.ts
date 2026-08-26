import { apiUrl, meshFetchAuthed, parseJson } from './apiClient'

/** RN-026: de dónde salió el ítem del checklist de preparativos. */
export type OrigenChecklistApi = 'sugerido' | 'lider' | 'personal'

export type ChecklistItemApi = {
  id: string
  viaje_id: string
  usuario_id: string
  texto: string
  origen: OrigenChecklistApi
  completado: boolean
  orden: number
  /** El backend decide (RN-030): las copias de un ítem base del creador no se editan. */
  puede_editar: boolean
  created_at: string
  updated_at: string
}

export type ImportarChecklistResponse = {
  importados: number
  omitidos: number
  items: ChecklistItemApi[]
}

/** RN-026: devuelve mi checklist del viaje, ya sembrado y sincronizado por el backend. */
export async function listarChecklist(viajeId: string): Promise<ChecklistItemApi[]> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/checklist`))
  return parseJson<ChecklistItemApi[]>(res)
}

export async function agregarItemChecklist(
  viajeId: string,
  input: { texto: string; paraTodos?: boolean }
): Promise<ChecklistItemApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/checklist`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<ChecklistItemApi>(res)
}

export async function actualizarItemChecklist(
  viajeId: string,
  itemId: string,
  input: { texto?: string; completado?: boolean }
): Promise<ChecklistItemApi> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/checklist/${itemId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<ChecklistItemApi>(res)
}

export async function eliminarItemChecklist(viajeId: string, itemId: string): Promise<void> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/checklist/${itemId}`), {
    method: 'DELETE',
  })
  // 204 sin cuerpo: parseJson tolera respuesta vacía y valida el status.
  await parseJson<null>(res)
}

/** RN-026 (reutilización): copia a este viaje los ítems propios de otro viaje. */
export async function importarChecklist(
  viajeId: string,
  viajeOrigenId: string
): Promise<ImportarChecklistResponse> {
  const res = await meshFetchAuthed(apiUrl(`/api/viajes/${viajeId}/checklist/importar`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viajeOrigenId }),
  })
  return parseJson<ImportarChecklistResponse>(res)
}
