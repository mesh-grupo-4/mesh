import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState, Platform, Vibration } from 'react-native'

import { TripStartedModal } from '@/components/TripStartedModal'
import { useAuth } from '@/context/AuthContext'
import { connectMeshSocket } from '@/lib/meshSocket'
import { iniciarTrackingViaje, solicitarPermisosUbicacion } from '@/lib/tracking/trackingControl'
import { subscribeTripChannel, type TripStartedPayload } from '@/lib/tripBroadcast'
import { isSupabaseConfigured } from '@/lib/supabase'
import { listarViajesPlanificados, obtenerViajeEnCurso } from '@/lib/viajesApi'

const WATCH_TRIP_IDS_KEY = 'mesh:watchTripIds'
const REFRESH_INTERVAL_MS = 45_000

type TripRealtimeContextValue = {
  pendingTrip: TripStartedPayload | null
  /** Registra viajes confirmados/en curso para escuchar TRIP_STARTED en cualquier pantalla. */
  syncKnownTripIds: (viajeIds: string[]) => void
}

const TripRealtimeContext = createContext<TripRealtimeContextValue | null>(null)

export function useTripRealtime(): TripRealtimeContextValue {
  const ctx = useContext(TripRealtimeContext)
  if (!ctx) {
    throw new Error('useTripRealtime debe usarse dentro de TripRealtimeProvider')
  }
  return ctx
}

function vibrateAlert(): void {
  if (Platform.OS === 'web') return
  Vibration.vibrate([0, 400, 200, 400])
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function TripRealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { backendUserId, backendSyncing } = useAuth()
  const [pendingTrip, setPendingTrip] = useState<TripStartedPayload | null>(null)
  const [joining, setJoining] = useState(false)
  const cleanupsRef = useRef<(() => void)[]>([])
  const shownTripIdsRef = useRef<Set<string>>(new Set())
  const watchIdsRef = useRef<Set<string>>(new Set())
  const socketHandlerRef = useRef<
    | ((payload: {
        viajeId: string
        nombre?: string | null
        fechaInicioReal?: string | null
        iniciadoPor?: string
      }) => void)
    | null
  >(null)
  const refreshInFlightRef = useRef(false)

  const clearSubscriptions = useCallback(() => {
    for (const off of cleanupsRef.current) off()
    cleanupsRef.current = []
  }, [])

  const handleTripStarted = useCallback(
    (payload: TripStartedPayload) => {
      if (!backendUserId) return
      if (payload.iniciadoPor === backendUserId) return
      if (shownTripIdsRef.current.has(payload.viajeId)) return

      shownTripIdsRef.current.add(payload.viajeId)
      vibrateAlert()
      setPendingTrip(payload)
    },
    [backendUserId]
  )

  const persistWatchIds = useCallback(async (ids: Set<string>) => {
    await AsyncStorage.setItem(WATCH_TRIP_IDS_KEY, JSON.stringify([...ids]))
  }, [])

  const loadCachedWatchIds = useCallback(async (): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(WATCH_TRIP_IDS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as string[]
      if (!Array.isArray(parsed)) return
      for (const id of parsed) {
        if (typeof id === 'string' && id.trim()) watchIdsRef.current.add(id)
      }
    } catch {
      /* */
    }
  }, [])

  const attachSocketListener = useCallback(
    (sock: Awaited<ReturnType<typeof connectMeshSocket>>) => {
      if (socketHandlerRef.current) {
        sock.off('viaje:iniciado', socketHandlerRef.current)
      }

      const onSocketInicio = (payload: {
        viajeId: string
        nombre?: string | null
        estado?: string
        fechaInicioReal?: string | null
        iniciadoPor?: string
      }) => {
        handleTripStarted({
          viajeId: payload.viajeId,
          nombre: payload.nombre ?? null,
          estado: 'en_curso',
          fechaInicioReal: payload.fechaInicioReal ?? new Date().toISOString(),
          iniciadoPor: payload.iniciadoPor ?? '',
        })
      }

      socketHandlerRef.current = onSocketInicio
      sock.on('viaje:iniciado', onSocketInicio)
      cleanupsRef.current.push(() => {
        sock.off('viaje:iniciado', onSocketInicio)
        if (socketHandlerRef.current === onSocketInicio) {
          socketHandlerRef.current = null
        }
      })
    },
    [handleTripStarted]
  )

  const applySubscriptions = useCallback(
    async (viajeIds: Set<string>) => {
      clearSubscriptions()

      if (viajeIds.size === 0) return

      if (isSupabaseConfigured()) {
        for (const viajeId of viajeIds) {
          const off = subscribeTripChannel(viajeId, handleTripStarted)
          cleanupsRef.current.push(off)
        }
      }

      try {
        const sock = await connectMeshSocket()
        for (const viajeId of viajeIds) {
          sock.emit('join_viaje', { viajeId })
        }
        attachSocketListener(sock)
      } catch (e) {
        console.warn('[TripRealtime] Socket.io no conectó:', e)
      }
    },
    [clearSubscriptions, handleTripStarted, attachSocketListener]
  )

  const fetchWatchIdsFromApi = useCallback(async (userId: string): Promise<Set<string>> => {
    const ids = new Set<string>(watchIdsRef.current)

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [planificados, enCurso] = await Promise.all([
          listarViajesPlanificados(userId),
          obtenerViajeEnCurso(userId),
        ])

        for (const v of planificados) {
          if (v.mi_estado === 'confirmado' || v.mi_estado === 'creador') {
            ids.add(v.id)
          }
        }

        if (enCurso) {
          ids.add(enCurso.id)
        }

        watchIdsRef.current = ids
        await persistWatchIds(ids)
        return ids
      } catch (e) {
        if (attempt < 2) await sleep(1500)
        else console.warn('[TripRealtime] Listado de viajes falló tras reintentos:', e)
      }
    }

    return ids
  }, [persistWatchIds])

  const refreshSubscriptions = useCallback(async () => {
    if (!backendUserId || backendSyncing) return
    if (refreshInFlightRef.current) return

    refreshInFlightRef.current = true
    try {
      const ids = await fetchWatchIdsFromApi(backendUserId)
      await applySubscriptions(ids)
    } finally {
      refreshInFlightRef.current = false
    }
  }, [backendUserId, backendSyncing, fetchWatchIdsFromApi, applySubscriptions])

  const syncKnownTripIds = useCallback(
    (viajeIds: string[]) => {
      let changed = false
      for (const id of viajeIds) {
        if (!id.trim()) continue
        if (!watchIdsRef.current.has(id)) {
          watchIdsRef.current.add(id)
          changed = true
        }
      }
      if (!changed) return
      void persistWatchIds(watchIdsRef.current).then(() => refreshSubscriptions())
    },
    [persistWatchIds, refreshSubscriptions]
  )

  useEffect(() => {
    void loadCachedWatchIds().then(() => refreshSubscriptions())
    return clearSubscriptions
  }, [loadCachedWatchIds, refreshSubscriptions, clearSubscriptions])

  useEffect(() => {
    if (!backendSyncing && backendUserId) {
      void refreshSubscriptions()
    }
  }, [backendSyncing, backendUserId, refreshSubscriptions])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshSubscriptions()
    })
    return () => sub.remove()
  }, [refreshSubscriptions])

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refreshSubscriptions()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshSubscriptions])

  const handleJoin = useCallback(async () => {
    if (!pendingTrip || !backendUserId) return
    setJoining(true)
    const { viajeId } = pendingTrip

    try {
      const perm = await solicitarPermisosUbicacion()
      if (perm.foreground && Platform.OS !== 'web') {
        await iniciarTrackingViaje(viajeId, backendUserId)
      }

      const sock = await connectMeshSocket()
      sock.emit('join_viaje', { viajeId })

      setPendingTrip(null)
      router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
    } catch (e) {
      console.warn('[TripRealtime] Error al unirse:', e)
      setPendingTrip(null)
      router.push({ pathname: '/viaje/[viajeId]/live', params: { viajeId } })
    } finally {
      setJoining(false)
    }
  }, [pendingTrip, backendUserId, router])

  return (
    <TripRealtimeContext.Provider value={{ pendingTrip, syncKnownTripIds }}>
      {children}
      <TripStartedModal
        visible={pendingTrip != null}
        trip={pendingTrip}
        joining={joining}
        onJoin={() => void handleJoin()}
      />
    </TripRealtimeContext.Provider>
  )
}
