import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { obtenerFantasma, type FantasmaApi, type PuntoFantasmaApi } from '@/lib/fantasmaApi'

type Options = {
  viajeId: string
  /** El fantasma corre contra el reloj del viaje: mismo punto de partida para los dos. */
  fechaInicioReal: string | null
  /** Metros que llevo recorridos (useTripMetrics). */
  miDistanciaM: number
  habilitado: boolean
}

export type EstadoFantasma = {
  nombre: string
  autor: string
  interpolado: boolean
  pausado: boolean
  terminado: boolean
  /** Posición actual del fantasma en el mapa. */
  posicion: { lat: number; lng: number }
  /** Recorrido completo, para dibujarlo tenue. */
  traza: [number, number][]
  /** Metros que le llevo (positivo) o que me lleva (negativo). */
  deltaM: number
  /** Segundos de ventaja (positivo) o desventaja (negativo). */
  gapSeg: number
  progresoPct: number
}

function claveStorage(viajeId: string) {
  return `mesh:fantasma:${viajeId}`
}

/** Interpola lat/lng/d_m para un instante t (seg) de la traza. */
function estadoEn(puntos: PuntoFantasmaApi[], t: number): { lat: number; lng: number; d: number } {
  const primero = puntos[0]!
  const ultimo = puntos[puntos.length - 1]!
  if (t <= primero.t_seg) return { lat: primero.lat, lng: primero.lng, d: primero.d_m }
  if (t >= ultimo.t_seg) return { lat: ultimo.lat, lng: ultimo.lng, d: ultimo.d_m }
  let lo = 0
  let hi = puntos.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (puntos[mid]!.t_seg <= t) lo = mid
    else hi = mid
  }
  const a = puntos[lo]!
  const b = puntos[hi]!
  const f = b.t_seg > a.t_seg ? (t - a.t_seg) / (b.t_seg - a.t_seg) : 0
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
    d: a.d_m + (b.d_m - a.d_m) * f,
  }
}

/** Instante en que el fantasma alcanzó la distancia `d` (para el gap en segundos). */
function tiempoEnDistancia(puntos: PuntoFantasmaApi[], d: number): number {
  const ultimo = puntos[puntos.length - 1]!
  if (d >= ultimo.d_m) return ultimo.t_seg
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]!
    const b = puntos[i]!
    if (b.d_m >= d) {
      const f = b.d_m > a.d_m ? (d - a.d_m) / (b.d_m - a.d_m) : 0
      return a.t_seg + (b.t_seg - a.t_seg) * f
    }
  }
  return 0
}

/**
 * RN-073 (SCRUM-49): anima un recorrido histórico contra el reloj del viaje y
 * dice si voy adelante o atrás. Se puede pausar (congela su reloj) o quitar.
 */
export function useFantasma({ viajeId, fechaInicioReal, miDistanciaM, habilitado }: Options) {
  const [fantasma, setFantasma] = useState<FantasmaApi | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [tick, setTick] = useState(0)
  /** Segundos acumulados en pausa: el fantasma no avanza mientras está pausado. */
  const pausaAcumRef = useRef(0)
  const pausaDesdeRef = useRef<number | null>(null)

  // Rehidrata la elección al volver a entrar a la pantalla.
  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cancelado = false
    void (async () => {
      try {
        const ref = await AsyncStorage.getItem(claveStorage(viajeId))
        if (!ref || cancelado) return
        setCargando(true)
        const f = await obtenerFantasma(viajeId, ref)
        if (!cancelado) setFantasma(f)
      } catch {
        /* sin fantasma previo o sin red: se elige a mano */
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [viajeId, habilitado])

  useEffect(() => {
    if (!fantasma || pausado) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [fantasma, pausado])

  const activar = useCallback(
    async (ref: string) => {
      setCargando(true)
      try {
        const f = await obtenerFantasma(viajeId, ref)
        pausaAcumRef.current = 0
        pausaDesdeRef.current = null
        setPausado(false)
        setFantasma(f)
        await AsyncStorage.setItem(claveStorage(viajeId), ref)
        return f
      } finally {
        setCargando(false)
      }
    },
    [viajeId]
  )

  const quitar = useCallback(() => {
    setFantasma(null)
    setPausado(false)
    void AsyncStorage.removeItem(claveStorage(viajeId))
  }, [viajeId])

  const alternarPausa = useCallback(() => {
    setPausado((p) => {
      if (!p) {
        pausaDesdeRef.current = Date.now()
      } else if (pausaDesdeRef.current != null) {
        pausaAcumRef.current += (Date.now() - pausaDesdeRef.current) / 1000
        pausaDesdeRef.current = null
      }
      return !p
    })
  }, [])

  const estado = useMemo<EstadoFantasma | null>(() => {
    if (!fantasma || fantasma.puntos.length < 2) return null
    const inicioMs = fechaInicioReal ? new Date(fechaInicioReal).getTime() : Date.now()
    const enPausa = pausaDesdeRef.current != null ? (Date.now() - pausaDesdeRef.current) / 1000 : 0
    const t = Math.max(0, (Date.now() - inicioMs) / 1000 - pausaAcumRef.current - enPausa)
    const g = estadoEn(fantasma.puntos, t)
    const deltaM = miDistanciaM - g.d
    const gapSeg = tiempoEnDistancia(fantasma.puntos, miDistanciaM) - t
    return {
      nombre: fantasma.nombre,
      autor: fantasma.autor,
      interpolado: fantasma.interpolado,
      pausado,
      terminado: t >= fantasma.duracion_seg,
      posicion: { lat: g.lat, lng: g.lng },
      traza: fantasma.puntos.map((p) => [p.lat, p.lng] as [number, number]),
      deltaM,
      gapSeg,
      progresoPct: fantasma.distancia_m > 0 ? Math.min(100, (g.d / fantasma.distancia_m) * 100) : 0,
    }
    // `tick` fuerza el recálculo por segundo aunque no cambie mi distancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fantasma, fechaInicioReal, miDistanciaM, pausado, tick])

  return { fantasma: estado, activo: fantasma != null, cargando, activar, quitar, alternarPausa }
}
