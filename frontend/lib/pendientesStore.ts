import { useEffect, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { listarSolicitudesAmistadPendientes } from '@/lib/amistadesApi'
import { listarInvitacionesPendientes } from '@/lib/gruposApi'

/**
 * Conteo de pendientes que se muestran como badge en la pestaña "Grupos":
 * invitaciones a grupos + solicitudes de amistad recibidas.
 *
 * Store a nivel módulo: las pantallas que ya cargan esas listas
 * (`grupos.tsx`, `AmigosTabPanel`) informan su largo con los setters, así el
 * badge se actualiza al instante al aceptar/rechazar sin pedir de nuevo.
 */
type Pendientes = { invitaciones: number; solicitudes: number }

let estado: Pendientes = { invitaciones: 0, solicitudes: 0 }
const listeners = new Set<() => void>()

function emitir(next: Pendientes) {
  if (next.invitaciones === estado.invitaciones && next.solicitudes === estado.solicitudes) return
  estado = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setInvitacionesPendientesCount(n: number) {
  emitir({ ...estado, invitaciones: n })
}

export function setSolicitudesPendientesCount(n: number) {
  emitir({ ...estado, solicitudes: n })
}

/** Pide ambos conteos al backend. Si una llamada falla, conserva el valor previo. */
export async function refrescarPendientes(userId: string): Promise<void> {
  const [inv, sol] = await Promise.allSettled([
    listarInvitacionesPendientes(userId),
    listarSolicitudesAmistadPendientes(userId),
  ])
  emitir({
    invitaciones: inv.status === 'fulfilled' ? inv.value.length : estado.invitaciones,
    solicitudes: sol.status === 'fulfilled' ? sol.value.length : estado.solicitudes,
  })
}

const POLL_MS = 60_000

/**
 * Total de pendientes para el badge. Refresca al montar, al volver la app a
 * primer plano y cada minuto mientras esté activa.
 */
export function usePendientesBadge(userId: string | null): number {
  const snap = useSyncExternalStore(subscribe, () => estado)

  useEffect(() => {
    if (!userId) {
      emitir({ invitaciones: 0, solicitudes: 0 })
      return
    }
    const refrescar = () => void refrescarPendientes(userId)
    refrescar()
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refrescar()
    }, POLL_MS)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refrescar()
    })
    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [userId])

  return snap.invitaciones + snap.solicitudes
}
