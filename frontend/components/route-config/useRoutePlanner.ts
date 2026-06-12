import * as Crypto from 'expo-crypto'
import * as Location from 'expo-location'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'

import {
  calcularRutaOsrm,
  perfilOsrmDesdeActividad,
  type OsrmRouteResult,
} from '@/lib/osrm'
import { guardarRutaEnBackend } from '@/lib/viajesApi'
import type { PutRutaBody } from '@/lib/viajesTypes'
import type { TipoActividadApi } from '@/lib/viajesApi'

import { REGION_FALLBACK, type RouteWaypoint, waypointTieneCoords } from './routeTypes'

const MAX_PARADAS = 10

function crearWaypoint(type: RouteWaypoint['type']): RouteWaypoint {
  return {
    id: Crypto.randomUUID(),
    type,
    lat: null,
    lon: null,
    name: '',
  }
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

function formatDuration(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return `${h} h ${r} min`
}

export type CameraTarget = {
  latitude: number
  longitude: number
}

type UseRoutePlannerArgs = {
  viajeId: string
  userId: string
  tipoActividad?: TipoActividadApi
  onSaved?: () => void
}

export function useRoutePlanner({ viajeId, userId, tipoActividad, onSaved }: UseRoutePlannerArgs) {
  const [origen, setOrigen] = useState<RouteWaypoint>(() => crearWaypoint('ORIGIN'))
  const [destino, setDestino] = useState<RouteWaypoint>(() => crearWaypoint('DESTINATION'))
  const [paradas, setParadas] = useState<RouteWaypoint[]>([])

  const movilidad = useMemo(
    () => perfilOsrmDesdeActividad(tipoActividad ?? 'bici'),
    [tipoActividad]
  )

  const [regionInicial, setRegionInicial] = useState(REGION_FALLBACK)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)

  const [rutaOk, setRutaOk] = useState<OsrmRouteResult | null>(null)
  const [routeLineLatLng, setRouteLineLatLng] = useState<[number, number][] | null>(null)
  const [errorRuta, setErrorRuta] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)

  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let cancel = false
    async function centrarUbicacion() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (cancel) return
        setRegionInicial({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        })
      } catch {
        /* usar fallback */
      }
    }
    void centrarUbicacion()
    return () => {
      cancel = true
    }
  }, [])

  const waypointsOrdenados = useMemo(
    () => [origen, ...paradas, destino],
    [origen, paradas, destino]
  )

  const waypointsConCoords = useMemo(
    () => waypointsOrdenados.filter(waypointTieneCoords),
    [waypointsOrdenados]
  )

  useEffect(() => {
    let cancel = false
    async function run() {
      const origenOk = waypointTieneCoords(origen)
      const destinoOk = waypointTieneCoords(destino)
      if (!origenOk || !destinoOk) {
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta(null)
        setCalculando(false)
        return
      }

      const paradasOk = paradas.every(waypointTieneCoords)
      if (!paradasOk) {
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta(null)
        setCalculando(false)
        return
      }

      setCalculando(true)
      setErrorRuta(null)

      const pts: [number, number][] = waypointsConCoords.map((w) => [w.lon, w.lat])

      try {
        const res = await calcularRutaOsrm(movilidad, pts)
        if (cancel) return
        setRutaOk(res)
        setRouteLineLatLng(res.polylineLatLng)
      } catch {
        if (cancel) return
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta('No se pudo calcular la ruta. Verifica la ubicación de los puntos.')
      } finally {
        if (!cancel) setCalculando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [origen, destino, paradas, movilidad, waypointsConCoords])

  const actualizarWaypoint = useCallback((id: string, patch: Partial<Pick<RouteWaypoint, 'lat' | 'lon' | 'name'>>) => {
    const apply = (w: RouteWaypoint): RouteWaypoint => {
      if (w.id !== id) return w
      return { ...w, ...patch }
    }
    setOrigen((prev) => apply(prev))
    setDestino((prev) => apply(prev))
    setParadas((prev) => prev.map(apply))

    if (patch.lat != null && patch.lon != null) {
      setCameraTarget({ latitude: patch.lat, longitude: patch.lon })
    }
  }, [])

  const agregarParada = useCallback(() => {
    setParadas((prev) => {
      if (prev.length >= MAX_PARADAS) {
        Alert.alert('Límite', `Máximo ${MAX_PARADAS} paradas intermedias.`)
        return prev
      }
      return [...prev, crearWaypoint('STOP')]
    })
  }, [])

  const eliminarParada = useCallback((id: string) => {
    setParadas((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const moverParada = useCallback((id: string, dir: 'up' | 'down') => {
    setParadas((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx < 0) return prev
      const next = dir === 'up' ? idx - 1 : idx + 1
      if (next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const tmp = copy[idx]
      copy[idx] = copy[next]
      copy[next] = tmp
      return copy
    })
  }, [])

  const confirmarHabilitado =
    Boolean(viajeId) &&
    Boolean(userId?.trim()) &&
    waypointTieneCoords(origen) &&
    waypointTieneCoords(destino) &&
    paradas.every(waypointTieneCoords) &&
    Boolean(rutaOk) &&
    !calculando &&
    !guardando

  const resumenDistancia = rutaOk ? formatDistance(rutaOk.distanceM) : null
  const resumenTiempo = rutaOk ? formatDuration(rutaOk.durationSec) : null

  const guardar = useCallback(async () => {
    if (!confirmarHabilitado || !rutaOk || !waypointTieneCoords(origen) || !waypointTieneCoords(destino)) {
      return
    }

    setGuardando(true)
    try {
      const body: PutRutaBody = {
        origen: { type: 'Point', coordinates: [origen.lon, origen.lat] },
        destino: { type: 'Point', coordinates: [destino.lon, destino.lat] },
        linestring: rutaOk.linestring,
        tiempoEstimadoSeg: Math.round(rutaOk.durationSec),
        paradas: paradas.filter(waypointTieneCoords).map((p, i) => ({
          orden: i,
          lat: p.lat,
          lng: p.lon,
          categoria: 'otro' as const,
        })),
      }
      await guardarRutaEnBackend(viajeId, userId.trim(), body)
      Alert.alert('Listo', 'La ruta se guardó correctamente.', [{ text: 'OK', onPress: onSaved }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      Alert.alert('Error', msg)
    } finally {
      setGuardando(false)
    }
  }, [confirmarHabilitado, rutaOk, origen, destino, paradas, viajeId, userId, onSaved])

  return {
    origen,
    destino,
    paradas,
    regionInicial,
    cameraTarget,
    setCameraTarget,
    routeLineLatLng,
    waypointsConCoords,
    calculando,
    errorRuta,
    resumenDistancia,
    resumenTiempo,
    confirmarHabilitado,
    guardando,
    actualizarWaypoint,
    agregarParada,
    eliminarParada,
    moverParada,
    guardar,
  }
}
