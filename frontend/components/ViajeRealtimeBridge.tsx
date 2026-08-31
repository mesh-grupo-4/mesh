import { useAuth } from '@/context/AuthContext'
import { connectMeshSocket, getMeshSocket } from '@/lib/meshSocket'
import { upsertUbicacionViva } from '@/lib/viajesApi'
import { useEffect } from 'react'
import { AppState, DeviceEventEmitter } from 'react-native'

import { dequeueGpsSample, flushGpsQueue } from '@/lib/tracking/gpsQueue'

type LocationTick = {
  viajeId: string
  userId: string
  lat: number
  lng: number
  accuracy?: number
  recordedAt: string
  /** Id de la fila en la cola SQLite local, para borrarla si este tick se confirma en vivo. */
  queueId?: number
}

/** Fallback por socket con ack: solo se considera confirmado si el servidor responde `ok`. */
async function emitGpsPingConAck(p: LocationTick, userId: string): Promise<boolean> {
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
  return new Promise<boolean>((resolve) => {
    sock
      .timeout(5000)
      .emit('viaje:gps_ping', payload, (err: unknown, res?: { ok: boolean }) => {
        resolve(!err && !!res?.ok)
      })
  })
}

/** Envía el tick en vivo (REST, con fallback a socket) y confirma si quedó persistido. */
async function confirmarEnvioEnVivo(p: LocationTick, userId: string): Promise<boolean> {
  try {
    await upsertUbicacionViva(p.viajeId, userId, {
      lat: p.lat,
      lng: p.lng,
      precision: p.accuracy ?? null,
      recordedAt: p.recordedAt,
    })
    return true
  } catch {
    try {
      return await emitGpsPingConAck(p, userId)
    } catch {
      return false
    }
  }
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

      void confirmarEnvioEnVivo(p, userId).then((ok) => {
        // Si no se confirmó (sin red), la fila queda en SQLite y flushGpsQueue la
        // sincroniza después como offline_sync — sin perder el registro (RN-038).
        if (ok && p.queueId != null) dequeueGpsSample(p.queueId)
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
