import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { obtenerFantasma, type FantasmaApi, type PuntoFantasmaApi } from '@/lib/fantasmaApi'
import { haversineDistanceM } from '@/lib/geo/haversine'

type Options = {
  viajeId: string
  /** Mi posición actual: el fantasma larga cuando llego a la salida de su recorrido. */
  miPosicion: { lat: number; lng: number } | null
  /** Metros que llevo recorridos (useTripMetrics). */
  miDistanciaM: number
  habilitado: boolean
  /**
   * RN-066: fantasma que se carga solo si todavía no se eligió ninguno (la sesión
   * que este viaje repite). Si la persona lo quita, no vuelve a aparecer.
   */
  refAutomatica?: string | null
}

export type EstadoFantasma = {
  nombre: string
  autor: string
  interpolado: boolean
  pausado: boolean
  /** Todavía no llegué a la salida del recorrido: el fantasma espera ahí, sin correr. */
  esperandoSalida: boolean
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

/** Marca guardada al quitar el fantasma: evita que el automático reaparezca. */
const SIN_FANTASMA = 'ninguno'

function claveLargada(viajeId: string) {
  return `mesh:fantasma:largada:${viajeId}`
}

/** A esta distancia de la salida del recorrido se considera que llegué y larga el fantasma. */
const RADIO_SALIDA_M = 40

/** Momento en que llegué a la salida y cuánto llevaba recorrido hasta ahí. */
type Largada = { inicioMs: number; distanciaBaseM: number }

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
export function useFantasma({
  viajeId,
  miPosicion,
  miDistanciaM,
  habilitado,
  refAutomatica = null,
}: Options) {
  const [fantasma, setFantasma] = useState<FantasmaApi | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [tick, setTick] = useState(0)
  /** Segundos acumulados en pausa: el fantasma no avanza mientras está pausado. */
  const pausaAcumRef = useRef(0)
  const pausaDesdeRef = useRef<number | null>(null)
  const [largada, setLargada] = useState<Largada | null>(null)
  const [largadaLeida, setLargadaLeida] = useState(false)

  // La largada se guarda: al volver a entrar a la pantalla el fantasma sigue donde iba.
  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cancelado = false
    void AsyncStorage.getItem(claveLargada(viajeId))
      .then((raw) => {
        if (cancelado) return
        if (raw) setLargada(JSON.parse(raw) as Largada)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setLargadaLeida(true)
      })
    return () => {
      cancelado = true
    }
  }, [viajeId, habilitado])

  // El fantasma larga recién cuando llego a la salida de su recorrido, no al iniciar
  // el viaje: el tramo hasta la salida no cuenta ni en tiempo ni en distancia.
  const salida = fantasma?.puntos[0] ?? null
  useEffect(() => {
    if (!salida || !miPosicion || largada || !largadaLeida) return
    const d = haversineDistanceM(miPosicion.lat, miPosicion.lng, salida.lat, salida.lng)
    if (d > RADIO_SALIDA_M) return
    const nueva: Largada = { inicioMs: Date.now(), distanciaBaseM: miDistanciaM }
    pausaAcumRef.current = 0
    pausaDesdeRef.current = pausado ? Date.now() : null
    setLargada(nueva)
    void AsyncStorage.setItem(claveLargada(viajeId), JSON.stringify(nueva))
  }, [salida, miPosicion, largada, largadaLeida, miDistanciaM, pausado, viajeId])

  // Rehidrata la elección al volver a entrar a la pantalla.
  useEffect(() => {
    if (!viajeId || !habilitado) return
    let cancelado = false
    void (async () => {
      try {
        const guardada = await AsyncStorage.getItem(claveStorage(viajeId))
        if (guardada === SIN_FANTASMA) return
        const ref = guardada ?? refAutomatica
        if (!ref || cancelado) return
        setCargando(true)
        const f = await obtenerFantasma(viajeId, ref)
        if (cancelado) return
        setFantasma(f)
        if (!guardada) await AsyncStorage.setItem(claveStorage(viajeId), ref)
      } catch {
        /* sin fantasma previo, sin red o sin traza en esa sesión: se elige a mano */
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [viajeId, habilitado, refAutomatica])

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
    void AsyncStorage.setItem(claveStorage(viajeId), SIN_FANTASMA)
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
    const enPausa = pausaDesdeRef.current != null ? (Date.now() - pausaDesdeRef.current) / 1000 : 0
    // Sin largada el fantasma espera quieto en la salida (t = 0) y no hay ventaja que medir.
    const t = largada
      ? Math.max(0, (Date.now() - largada.inicioMs) / 1000 - pausaAcumRef.current - enPausa)
      : 0
    const miDistancia = largada ? Math.max(0, miDistanciaM - largada.distanciaBaseM) : 0
    const g = estadoEn(fantasma.puntos, t)
    const deltaM = miDistancia - g.d
    const gapSeg = tiempoEnDistancia(fantasma.puntos, miDistancia) - t
    return {
      nombre: fantasma.nombre,
      autor: fantasma.autor,
      interpolado: fantasma.interpolado,
      pausado,
      esperandoSalida: !largada,
      terminado: largada != null && t >= fantasma.duracion_seg,
      posicion: { lat: g.lat, lng: g.lng },
      traza: fantasma.puntos.map((p) => [p.lat, p.lng] as [number, number]),
      deltaM,
      gapSeg,
      progresoPct: fantasma.distancia_m > 0 ? Math.min(100, (g.d / fantasma.distancia_m) * 100) : 0,
    }
    // `tick` fuerza el recálculo por segundo aunque no cambie mi distancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fantasma, largada, miDistanciaM, pausado, tick])

  return { fantasma: estado, activo: fantasma != null, cargando, activar, quitar, alternarPausa }
}
