import { useAuth } from '@/context/AuthContext'
import { connectMeshSocket, getMeshSocket } from '@/lib/meshSocket'
import { upsertUbicacionViva } from '@/lib/viajesApi'
import { useEffect } from 'react'
import { AppState, DeviceEventEmitter } from 'react-native'

import { flushGpsQueue } from '@/lib/tracking/gpsQueue'

type LocationTick = {
  viajeId: string
  userId: string
  lat: number
  lng: number
  accuracy?: number
  recordedAt: string
}

async function emitGpsPing(p: LocationTick, userId: string): Promise<void> {
  const payload = {
    viajeId: p.viajeId,
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    recordedAt: p.recordedAt,
    source: 'live' as const,
  }
  let sock = getMeshSocket()
  if (!sock?.connected) {
    sock = await connectMeshSocket()
  }
  sock.emit('viaje:gps_ping', payload)
}

/**
 * Puente global: cola GPS offline y envío de posición en vivo vía REST → Supabase Realtime.
 * Si REST falla (ej. iOS sin reachability momentánea), fallback por Socket.io.
 */
export function ViajeRealtimeBridge() {
  const { backendUserId } = useAuth()

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('mesh:location_tick', (p: LocationTick) => {
      const userId = backendUserId?.trim() || p.userId
      if (!userId) return

      void upsertUbicacionViva(p.viajeId, userId, {
        lat: p.lat,
        lng: p.lng,
        precision: p.accuracy ?? null,
        recordedAt: p.recordedAt,
      }).catch(() => {
        void emitGpsPing(p, userId).catch(() => {
          /* offline: queda en SQLite y flushGpsQueue sincroniza */
        })
      })
    })
    return () => sub.remove()
  }, [backendUserId])

  useEffect(() => {
    const flush = () => void flushGpsQueue()
    const interval = setInterval(flush, 15000)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') flush()
    })
    flush()
    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [])

  return null
}
