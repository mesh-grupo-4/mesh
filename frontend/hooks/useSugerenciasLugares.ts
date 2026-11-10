import { useCallback, useEffect, useRef, useState } from 'react'

import { MeshApiError } from '@/lib/apiClient'
import {
  MIN_LETRAS_SUGERENCIAS,
  resolverSugerencia,
  sugerirLugares,
  type LugarHit,
  type LugarSugerencia,
} from '@/lib/nominatim'

/** Pausa de tipeo antes de pedir sugerencias. */
const MS_ESPERA = 250

/** Traduce la falla real del buscador a algo accionable, en vez de siempre "sin conexión". */
export function mensajeErrorBusqueda(e: unknown): string {
  if (e instanceof MeshApiError) {
    if (e.code === 'GEOCODING_TIMEOUT') {
      return 'El buscador tardó demasiado en responder. Reintentá o probá el mapa.'
    }
    if (e.code === 'GEOCODING_RATE_LIMIT') {
      return 'Demasiadas búsquedas seguidas. Esperá un momento y reintentá.'
    }
    if (e.status === 401) {
      return 'Tu sesión expiró. Volvé a iniciar sesión.'
    }
    return 'No se pudo buscar en este momento. Probá seleccionar en el mapa.'
  }
  return 'Sin conexión. Probá seleccionar en el mapa.'
}

type Opciones = {
  /** Con `false` no busca y vacía las sugerencias (campo sin foco, etc.). */
  activo?: boolean
  /** Prioriza lugares cercanos a esta posición. */
  cerca?: { lat: number; lng: number } | null
}

/**
 * Sugerencias de lugares mientras se escribe (autocompletado de Google vía backend).
 * Cada respuesta se muestra apenas llega si es más nueva que la que está en
 * pantalla, aunque el usuario haya seguido tipeando.
 */
export function useSugerenciasLugares(texto: string, { activo = true, cerca = null }: Opciones = {}) {
  const [sugerencias, setSugerencias] = useState<LugarSugerencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** La última búsqueda mostrada respondió sin coincidencias. */
  const [sinResultados, setSinResultados] = useState(false)
  /** Nº de la última búsqueda lanzada y de la última cuya respuesta se mostró. */
  const pedidaRef = useRef(0)
  const mostradaRef = useRef(0)
  const cercaRef = useRef(cerca)

  useEffect(() => {
    cercaRef.current = cerca
  }, [cerca])

  const q = texto.trim()

  useEffect(() => {
    if (!activo || q.length < MIN_LETRAS_SUGERENCIAS) {
      // Invalida las búsquedas en vuelo: sus respuestas ya no se muestran.
      mostradaRef.current = ++pedidaRef.current
      setSugerencias([])
      setBuscando(false)
      setError(null)
      setSinResultados(false)
      return
    }
    const t = setTimeout(() => {
      const id = ++pedidaRef.current
      const esMasNueva = () => {
        if (id <= mostradaRef.current) return false
        mostradaRef.current = id
        return true
      }
      setBuscando(true)
      sugerirLugares(q, cercaRef.current)
        .then((r) => {
          if (!esMasNueva()) return
          setSugerencias(r)
          setSinResultados(r.length === 0)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!esMasNueva()) return
          setSugerencias([])
          setSinResultados(false)
          setError(mensajeErrorBusqueda(e))
        })
        .finally(() => {
          if (id === pedidaRef.current) setBuscando(false)
        })
    }, MS_ESPERA)
    return () => clearTimeout(t)
  }, [q, activo])

  /** Coordenadas de la sugerencia elegida; `null` (y `error` cargado) si falla. */
  const resolver = useCallback(async (s: LugarSugerencia): Promise<LugarHit | null> => {
    try {
      return await resolverSugerencia(s)
    } catch (e) {
      setError(mensajeErrorBusqueda(e))
      return null
    }
  }, [])

  return { sugerencias, buscando, error, sinResultados, resolver }
}
