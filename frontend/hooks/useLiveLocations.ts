import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectMeshSocket } from '@/lib/meshSocket'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { listarUbicacionesVivas, type UbicacionVivaSnapshotApi } from '@/lib/viajesApi'

export type MemberLocation = {
  usuarioId: string
  lat: number
  lng: number
  precision: number | null
  updatedAt: string
  nombre: string
  /** La última posición conocida quedó vieja: el integrante perdió señal. */
  isStale: boolean
}

/** Lo que guardamos en estado; `isStale` se deriva del reloj en cada render. */
type MemberSnapshot = Omit<MemberLocation, 'isStale'>

/** Refresco de respaldo con Realtime sano. */
const POLL_OK_MS = 15000
/** Refresco de respaldo con Realtime caído: debe quedar bajo los 10 s de RN-032. */
const POLL_DEGRADED_MS = 8000
/** Cada cuánto reevaluamos la frescura de las posiciones. */
const STALE_CHECK_MS = 10000
/** Seis ciclos GPS perdidos (RN-031: un ping cada 5 s). */
const STALE_AFTER_MS = 30000

type Options = {
  viajeId: string
  userId: string
  nameByUserId?: Record<string, string>
}

function rowToMember(row: UbicacionVivaSnapshotApi, names: Record<string, string>): MemberSnapshot {
  return {
    usuarioId: row.usuarioId,
    lat: row.lat,
    lng: row.lng,
    precision: row.precision,
    updatedAt: row.updatedAt,
    nombre: names[row.usuarioId] || row.nombre || 'Integrante',
  }
}

function dbRowToMember(
  row: Record<string, unknown>,
  names: Record<string, string>
): MemberSnapshot | null {
  const usuarioId = String(row.usuario_id ?? '')
  const viajeId = String(row.viaje_id ?? '')
  if (!usuarioId || !viajeId) return null
  return {
    usuarioId,
    lat: Number(row.lat),
    lng: Number(row.lng),
    precision: row.precision_m != null ? Number(row.precision_m) : null,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    nombre: names[usuarioId] || 'Integrante',
  }
}

function socketPayloadToMember(
  payload: {
    usuarioId: string
    lat: number
    lng: number
    precision: number | null
    recordedAt: string
  },
  names: Record<string, string>
): MemberSnapshot {
  return {
    usuarioId: payload.usuarioId,
    lat: payload.lat,
    lng: payload.lng,
    precision: payload.precision,
    updatedAt: payload.recordedAt,
    nombre: names[payload.usuarioId] || 'Integrante',
  }
}

export function useLiveLocations({ viajeId, userId, nameByUserId = {} }: Options) {
  const [members, setMembers] = useState<Record<string, MemberSnapshot>>({})
  const [realtimeOk, setRealtimeOk] = useState(true)
  const [staleTick, setStaleTick] = useState(0)
  const namesRef = useRef(nameByUserId)
  namesRef.current = nameByUserId

  const mergeMember = useCallback((member: MemberSnapshot) => {
    setMembers((prev) => ({ ...prev, [member.usuarioId]: member }))
  }, [])

  const loadSnapshot = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    try {
      const rows = await listarUbicacionesVivas(viajeId, userId)
      const next: Record<string, MemberSnapshot> = {}
      for (const row of rows) {
        next[row.usuarioId] = rowToMember(row, namesRef.current)
      }
      setMembers(next)
    } catch {
      /* red intermitente */
    }
  }, [viajeId, userId])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  // Refresco de respaldo. Vive en su propio efecto para que cambiar el período
  // no re-suscriba el socket ni el canal de Supabase.
  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    const periodo = realtimeOk ? POLL_OK_MS : POLL_DEGRADED_MS
    const poll = setInterval(() => void loadSnapshot(), periodo)
    return () => clearInterval(poll)
  }, [viajeId, userId, realtimeOk, loadSnapshot])

  // Reevalúa la frescura aunque no lleguen posiciones nuevas.
  useEffect(() => {
    const id = setInterval(() => setStaleTick((t) => t + 1), STALE_CHECK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    let socketCleanup: (() => void) | undefined
    let supabaseCleanup: (() => void) | undefined

    void (async () => {
      try {
        const sock = await connectMeshSocket()
        sock.emit('join_viaje', { viajeId }, (res?: { ok: boolean; error?: string }) => {
          if (__DEV__ && res && !res.ok) {
            console.warn(`[useLiveLocations] join_viaje rechazado: ${res.error}`)
          }
        })

        const onUbi = (payload: {
          viajeId: string
          usuarioId: string
          lat: number
          lng: number
          precision: number | null
          recordedAt: string
        }) => {
          if (payload.viajeId !== viajeId) return
          mergeMember(socketPayloadToMember(payload, namesRef.current))
        }

        sock.on('viaje:ubicacion', onUbi)
        socketCleanup = () => sock.off('viaje:ubicacion', onUbi)
      } catch {
        /* socket opcional si REST/Realtime funcionan */
      }
    })()

    if (isSupabaseConfigured()) {
      const supabase = getSupabase()
      const channel = supabase
        .channel(`ubicaciones:${viajeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ubicacion_viva',
            filter: `viaje_id=eq.${viajeId}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
            if (!row) return
            const member = dbRowToMember(row, namesRef.current)
            if (!member) return
            if (payload.eventType === 'DELETE') {
              setMembers((prev) => {
                const copy = { ...prev }
                delete copy[member.usuarioId]
                return copy
              })
              return
            }
            mergeMember(member)
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeOk(false)
          }
          if (status === 'SUBSCRIBED') {
            setRealtimeOk(true)
          }
        })

      supabaseCleanup = () => {
        void supabase.removeChannel(channel)
      }
    }

    return () => {
      socketCleanup?.()
      supabaseCleanup?.()
    }
  }, [viajeId, userId, mergeMember])

  useEffect(() => {
    setMembers((prev) => {
      const next = { ...prev }
      let changed = false
      for (const id of Object.keys(next)) {
        const name = nameByUserId[id]
        if (name && next[id]!.nombre !== name) {
          next[id] = { ...next[id]!, nombre: name }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [nameByUserId])

  const memberList = useMemo<MemberLocation[]>(() => {
    const ahora = Date.now()
    return Object.values(members).map((m) => {
      const ts = new Date(m.updatedAt).getTime()
      return {
        ...m,
        isStale: Number.isFinite(ts) ? ahora - ts > STALE_AFTER_MS : false,
      }
    })
    // `staleTick` fuerza el recálculo periódico aunque no cambien las posiciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, staleTick])

  const staleByUserId = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const m of memberList) map[m.usuarioId] = m.isStale
    return map
  }, [memberList])

  return { members, memberList, staleByUserId, realtimeOk }
}
