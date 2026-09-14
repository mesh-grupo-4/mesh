import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceEventEmitter } from 'react-native'

import { connectMeshSocket, joinViajeRoom, onMeshSocketConnect } from '@/lib/meshSocket'
import type { EstadoIntegranteApi } from '@/lib/paradasApi'
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
  /** RN-037: lo calcula el backend a partir de la parada abierta. */
  estado: EstadoIntegranteApi
  /** Inicio de la parada en curso, si está detenido. */
  paradaDesde: string | null
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
  /** Última posición GPS conocida en el dispositivo, para pintar "vos" sin
   * esperar a que la posición vaya y vuelva por el backend. */
  selfSeed?: { lat: number; lng: number } | null
}

type LocationTick = {
  viajeId: string
  userId: string
  lat: number
  lng: number
  accuracy?: number
  recordedAt: string
}

function rowToMember(row: UbicacionVivaSnapshotApi, names: Record<string, string>): MemberSnapshot {
  return {
    usuarioId: row.usuarioId,
    lat: row.lat,
    lng: row.lng,
    precision: row.precision,
    updatedAt: row.updatedAt,
    nombre: names[row.usuarioId] || row.nombre || 'Integrante',
    estado: row.estado ?? 'en_movimiento',
    paradaDesde: row.paradaDesde ?? null,
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
    estado: 'en_movimiento',
    paradaDesde: null,
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
    estado: 'en_movimiento',
    paradaDesde: null,
  }
}

export function useLiveLocations({ viajeId, userId, nameByUserId = {}, selfSeed = null }: Options) {
  const [members, setMembers] = useState<Record<string, MemberSnapshot>>({})
  const [realtimeOk, setRealtimeOk] = useState(true)
  const [staleTick, setStaleTick] = useState(0)
  const namesRef = useRef(nameByUserId)
  namesRef.current = nameByUserId

  const mergeMember = useCallback(
    (member: MemberSnapshot, opciones?: { conservarEstado?: boolean }) => {
      setMembers((prev) => {
        const anterior = prev[member.usuarioId]
        const conservar =
          opciones?.conservarEstado &&
          anterior &&
          (anterior.estado === 'detenido_voluntario' || anterior.estado === 'posible_incidente')
        const siguiente = conservar
          ? { ...member, estado: anterior.estado, paradaDesde: anterior.paradaDesde }
          : member
        return { ...prev, [member.usuarioId]: siguiente }
      })
    },
    []
  )

  /** US1/US3: aplica el cambio de estado que llega por socket, sin tocar la posición. */
  const aplicarEstado = useCallback(
    (usuarioId: string, estado: EstadoIntegranteApi, paradaDesde: string | null) => {
      setMembers((prev) => {
        const anterior = prev[usuarioId]
        if (!anterior) return prev
        if (anterior.estado === estado && anterior.paradaDesde === paradaDesde) return prev
        return { ...prev, [usuarioId]: { ...anterior, estado, paradaDesde } }
      })
    },
    []
  )

  const loadSnapshot = useCallback(async () => {
    if (!viajeId || !userId.trim()) return
    try {
      const rows = await listarUbicacionesVivas(viajeId, userId)
      const next: Record<string, MemberSnapshot> = {}
      for (const row of rows) {
        next[row.usuarioId] = rowToMember(row, namesRef.current)
      }
      setMembers((prev) => {
        // El snapshot del backend puede no traer todavía la fila propia (el
        // primer PUT de ubicación puede tardar unos segundos): no le pisamos
        // el pin local a "vos" con un snapshot que aún no la tiene.
        if (!next[userId] && prev[userId]) {
          return { ...next, [userId]: prev[userId] }
        }
        return next
      })
    } catch {
      /* red intermitente */
    }
  }, [viajeId, userId])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  // "Vos" en el mapa no debería depender de que el ping GPS complete el viaje
  // de ida y vuelta por el backend: lo pintamos con la última posición local
  // apenas se conoce y lo actualizamos con cada tick del tracking (cada 5 s).
  useEffect(() => {
    if (!selfSeed || !userId.trim()) return
    setMembers((prev) => {
      if (prev[userId]) return prev
      return {
        ...prev,
        [userId]: {
          usuarioId: userId,
          lat: selfSeed.lat,
          lng: selfSeed.lng,
          precision: null,
          updatedAt: new Date().toISOString(),
          nombre: namesRef.current[userId] || 'Vos',
          estado: 'en_movimiento',
          paradaDesde: null,
        },
      }
    })
  }, [selfSeed, userId])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return
    const sub = DeviceEventEmitter.addListener('mesh:location_tick', (tick: LocationTick) => {
      if (tick.viajeId !== viajeId || tick.userId !== userId) return
      mergeMember(
        {
          usuarioId: userId,
          lat: tick.lat,
          lng: tick.lng,
          precision: tick.accuracy ?? null,
          updatedAt: tick.recordedAt,
          nombre: namesRef.current[userId] || 'Vos',
          estado: 'en_movimiento',
          paradaDesde: null,
        },
        { conservarEstado: true }
      )
    })
    return () => sub.remove()
  }, [viajeId, userId, mergeMember])

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
    const sub = DeviceEventEmitter.addListener(
      'mesh:integrante_estado',
      (p: {
        viajeId: string
        usuarioId: string
        estado: EstadoIntegranteApi
        paradaDesde: string | null
      }) => {
        if (p.viajeId !== viajeId) return
        aplicarEstado(p.usuarioId, p.estado, p.paradaDesde)
      }
    )
    return () => sub.remove()
  }, [viajeId, userId, aplicarEstado])

  useEffect(() => {
    if (!viajeId || !userId.trim()) return

    let socketCleanup: (() => void) | undefined
    let supabaseCleanup: (() => void) | undefined

    void (async () => {
      try {
        joinViajeRoom(viajeId, (res) => {
          if (__DEV__ && res && !res.ok) {
            console.warn(`[useLiveLocations] join_viaje rechazado: ${res.error}`)
          }
        })
        const sock = await connectMeshSocket()

        // Tras una reconexión, lo que pasó mientras tanto no llegó por socket:
        // el snapshot REST vuelve a poner a todos donde están (RN-032).
        const offReconnect = onMeshSocketConnect(() => void loadSnapshot())

        const onUbi = (payload: {
          viajeId: string
          usuarioId: string
          lat: number
          lng: number
          precision: number | null
          recordedAt: string
        }) => {
          if (payload.viajeId !== viajeId) return
          mergeMember(socketPayloadToMember(payload, namesRef.current), { conservarEstado: true })
        }

        const onParadaIniciada = (payload: {
          viajeId: string
          usuarioId: string
          inicio: string
          estado?: EstadoIntegranteApi
        }) => {
          if (payload.viajeId !== viajeId) return
          aplicarEstado(
            payload.usuarioId,
            payload.estado ?? 'detenido_voluntario',
            payload.inicio
          )
        }

        const onParadaFinalizada = (payload: { viajeId: string; usuarioId: string }) => {
          if (payload.viajeId !== viajeId) return
          aplicarEstado(payload.usuarioId, 'en_movimiento', null)
        }

        // Quien sale del viaje deja de compartir ubicación: su marcador se va
        // ya mismo, no cuando venza como "sin señal".
        const onSalio = (payload: { viajeId: string; usuarioId: string }) => {
          if (payload.viajeId !== viajeId) return
          setMembers((prev) => {
            if (!prev[payload.usuarioId]) return prev
            const copy = { ...prev }
            delete copy[payload.usuarioId]
            return copy
          })
        }

        sock.on('viaje:ubicacion', onUbi)
        sock.on('viaje:parada_iniciada', onParadaIniciada)
        sock.on('viaje:parada_finalizada', onParadaFinalizada)
        sock.on('viaje:participante_salio', onSalio)
        socketCleanup = () => {
          offReconnect()
          sock.off('viaje:ubicacion', onUbi)
          sock.off('viaje:parada_iniciada', onParadaIniciada)
          sock.off('viaje:parada_finalizada', onParadaFinalizada)
          sock.off('viaje:participante_salio', onSalio)
        }
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
            const conservarEstado = true
            if (payload.eventType === 'DELETE') {
              setMembers((prev) => {
                const copy = { ...prev }
                delete copy[member.usuarioId]
                return copy
              })
              return
            }
            mergeMember(member, { conservarEstado })
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
  }, [viajeId, userId, mergeMember, aplicarEstado, loadSnapshot])

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
