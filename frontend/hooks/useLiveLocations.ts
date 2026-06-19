import { useCallback, useEffect, useRef, useState } from 'react'

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
}

type Options = {
  viajeId: string
  userId: string
  nameByUserId?: Record<string, string>
}

function rowToMember(row: UbicacionVivaSnapshotApi, names: Record<string, string>): MemberLocation {
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
): MemberLocation | null {
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
): MemberLocation {
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
  const [members, setMembers] = useState<Record<string, MemberLocation>>({})
  const [realtimeOk, setRealtimeOk] = useState(true)
  const namesRef = useRef(nameByUserId)
  namesRef.current = nameByUserId

  const mergeMember = useCallback((member: MemberLocation) => {
    setMembers((prev) => ({ ...prev, [member.usuarioId]: member }))
  }, [])

  const loadSnapshot = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    try {
      const rows = await listarUbicacionesVivas(viajeId, userId)
      const next: Record<string, MemberLocation> = {}
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

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    const poll = setInterval(() => void loadSnapshot(), 15000)

    let socketCleanup: (() => void) | undefined
    let supabaseCleanup: (() => void) | undefined

    void (async () => {
      try {
        const sock = await connectMeshSocket()
        sock.emit('join_viaje', { viajeId })

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
      clearInterval(poll)
      socketCleanup?.()
      supabaseCleanup?.()
    }
  }, [viajeId, userId, loadSnapshot, mergeMember])

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

  return { members, memberList: Object.values(members), realtimeOk }
}
