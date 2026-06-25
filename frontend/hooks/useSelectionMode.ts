import { useCallback, useState } from 'react'

export function useSelectionMode() {
  const [active, setActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const enter = useCallback((initialId?: string) => {
    setActive(true)
    setSelectedIds(initialId ? new Set([initialId]) : new Set())
  }, [])

  const exit = useCallback(() => {
    setActive(false)
    setSelectedIds(new Set())
  }, [])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setActive(true)
    setSelectedIds(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return {
    active,
    selectedIds,
    count: selectedIds.size,
    enter,
    exit,
    toggle,
    selectAll,
    clear,
    isSelected,
  }
}
