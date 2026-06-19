import type { RealtimeChannel } from '@supabase/supabase-js'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export const TRIP_STARTED_EVENT = 'TRIP_STARTED'

export type TripStartedPayload = {
  viajeId: string
  nombre: string | null
  estado: 'en_curso'
  fechaInicioReal: string
  iniciadoPor: string
}

function channelName(viajeId: string): string {
  return `trip:${viajeId}`
}

function waitForSubscribed(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Canal Supabase: ${status}`))
      }
    })
  })
}

export async function emitTripStarted(viajeId: string, payload: TripStartedPayload): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  const supabase = getSupabase()
  const channel = supabase.channel(channelName(viajeId))

  await waitForSubscribed(channel)

  const result = await channel.send({
    type: 'broadcast',
    event: TRIP_STARTED_EVENT,
    payload,
  })

  await supabase.removeChannel(channel)

  if (result !== 'ok') {
    throw new Error(`Broadcast TRIP_STARTED falló: ${result}`)
  }
}

/** Reintenta una vez si el primer envío falla (red inestable post-REST). */
export async function emitTripStartedWithRetry(
  viajeId: string,
  payload: TripStartedPayload
): Promise<void> {
  try {
    await emitTripStarted(viajeId, payload)
  } catch {
    await emitTripStarted(viajeId, payload)
  }
}

export function subscribeTripChannel(
  viajeId: string,
  onStarted: (payload: TripStartedPayload) => void
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {}
  }

  const supabase = getSupabase()
  const channel = supabase
    .channel(channelName(viajeId))
    .on('broadcast', { event: TRIP_STARTED_EVENT }, ({ payload }) => {
      onStarted(payload as TripStartedPayload)
    })

  void channel.subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
