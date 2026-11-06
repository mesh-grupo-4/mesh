import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useSyncExternalStore } from 'react'

/**
 * Alertas que el usuario ya vio, por viaje. Alimenta el contador de la
 * campanita del mapa en vivo: solo cuenta las que todavía no vio.
 *
 * Store a nivel módulo porque la pantalla en vivo y el historial de alertas
 * usan instancias distintas de `useAlertas`: al abrir el historial, la
 * campanita tiene que bajar al volver al mapa. Se persiste en el dispositivo
 * para que reabrir la app no vuelva a mostrar como nuevas las ya vistas.
 */
const PREFIJO = 'mesh:alertasVistas:'
const VACIO: ReadonlySet<string> = new Set()

const vistasPorViaje = new Map<string, ReadonlySet<string>>()
const cargados = new Set<string>()
const listeners = new Set<() => void>()

function emitir() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function persistir(viajeId: string, vistas: ReadonlySet<string>) {
  void AsyncStorage.setItem(PREFIJO + viajeId, JSON.stringify([...vistas])).catch(() => {
    /* sin almacenamiento el contador vale para esta sesión */
  })
}

async function cargar(viajeId: string): Promise<void> {
  if (cargados.has(viajeId)) return
  cargados.add(viajeId)
  try {
    const raw = await AsyncStorage.getItem(PREFIJO + viajeId)
    const guardadas: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(guardadas) || guardadas.length === 0) return
    // Se combinan con las que se hayan marcado mientras se leía el disco.
    const actuales = vistasPorViaje.get(viajeId) ?? VACIO
    const combinadas = new Set([
      ...guardadas.filter((x): x is string => typeof x === 'string'),
      ...actuales,
    ])
    vistasPorViaje.set(viajeId, combinadas)
    // Si se marcó algo antes de terminar de leer, ese guardado pisó al del disco.
    if (actuales.size > 0) persistir(viajeId, combinadas)
    emitir()
  } catch {
    /* dato corrupto o sin almacenamiento: se arranca de cero */
  }
}

export function marcarAlertasVistas(viajeId: string, ids: readonly string[]): void {
  if (!viajeId || ids.length === 0) return
  const actuales = vistasPorViaje.get(viajeId) ?? VACIO
  const nuevas = ids.filter((id) => !actuales.has(id))
  if (nuevas.length === 0) return
  const siguiente = new Set([...actuales, ...nuevas])
  vistasPorViaje.set(viajeId, siguiente)
  persistir(viajeId, siguiente)
  emitir()
}

/** IDs de alertas ya vistas en el viaje. Cambia de referencia solo cuando cambia el contenido. */
export function useAlertasVistas(viajeId: string): ReadonlySet<string> {
  const vistas = useSyncExternalStore(subscribe, () => vistasPorViaje.get(viajeId) ?? VACIO)
  useEffect(() => {
    if (viajeId) void cargar(viajeId)
  }, [viajeId])
  return vistas
}
