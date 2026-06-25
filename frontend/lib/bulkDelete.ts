export function formatItemList(names: string[], maxShown = 2): string {
  if (names.length === 0) return ''
  if (names.length <= maxShown) return names.join(', ')
  const shown = names.slice(0, maxShown).join(', ')
  const rest = names.length - maxShown
  return `${shown} y ${rest} más`
}

export type BulkDeleteResult = {
  ok: number
  failed: { id: string; label: string; error: string }[]
}

export async function runBulkDelete<T extends { id: string; label: string }>(
  items: T[],
  deleteOne: (item: T) => Promise<void>
): Promise<BulkDeleteResult> {
  const failed: BulkDeleteResult['failed'] = []
  let ok = 0

  for (const item of items) {
    try {
      await deleteOne(item)
      ok += 1
    } catch (e: unknown) {
      failed.push({
        id: item.id,
        label: item.label,
        error: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  return { ok, failed }
}

export function bulkDeleteSummary(result: BulkDeleteResult, entityLabel: string): string {
  if (result.failed.length === 0) {
    return `Se ${result.ok === 1 ? 'eliminó' : 'eliminaron'} ${result.ok} ${entityLabel}${result.ok === 1 ? '' : 's'} correctamente.`
  }

  const detalle = result.failed
    .map((f) => `${f.label}: ${f.error}`)
    .join('\n')

  if (result.ok === 0) {
    return `No se pudo eliminar ningún ${entityLabel}:\n${detalle}`
  }

  return `${result.ok} ${entityLabel}${result.ok === 1 ? '' : 's'} eliminado${result.ok === 1 ? '' : 's'}, ${result.failed.length} falló:\n${detalle}`
}
