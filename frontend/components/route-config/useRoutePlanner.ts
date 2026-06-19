import * as Crypto from 'expo-crypto'
import * as Location from 'expo-location'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Alert } from 'react-native'
import type { Region } from 'react-native-maps'

import {
  calcularRutaOsrm,
  perfilOsrmDesdeActividad,
  type OsrmRouteResult,
} from '@/lib/osrm'
import { reverseGeocode } from '@/lib/nominatim'
import { toPutRutaBody, waypointsFromRutaDetalle } from '@/lib/routePayload'
import { guardarRutaEnBackend, obtenerRuta } from '@/lib/viajesApi'
import type { TipoActividadApi } from '@/lib/viajesApi'

import {
  REGION_FALLBACK,
  type RouteWaypoint,
  type StopCategory,
  waypointTieneCoords,
} from './routeTypes'

const MAX_PARADAS = 10

function crearWaypoint(type: RouteWaypoint['type'], order: number): RouteWaypoint {
  return {
    id: Crypto.randomUUID(),
    type,
    lat: null,
    lon: null,
    name: '',
    category: type === 'STOP' ? 'otro' : null,
    order,
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

export type RouteBottomSheetHandle = {
  snapToMin: () => void
  snapToDefault: () => void
}

type UseRoutePlannerArgs = {
  viajeId: string
  userId: string
  tipoActividad?: TipoActividadApi
  onSaved?: () => void
  sheetRef?: RefObject<RouteBottomSheetHandle | null>
}

export function useRoutePlanner({
  viajeId,
  userId,
  tipoActividad,
  onSaved,
  sheetRef,
}: UseRoutePlannerArgs) {
  const [origen, setOrigen] = useState<RouteWaypoint>(() => crearWaypoint('ORIGIN', 0))
  const [destino, setDestino] = useState<RouteWaypoint>(() => crearWaypoint('DESTINATION', 1))
  const [paradas, setParadas] = useState<RouteWaypoint[]>([])
  const [cargandoRuta, setCargandoRuta] = useState(true)

  const movilidad = useMemo(
    () => perfilOsrmDesdeActividad(tipoActividad ?? 'bici'),
    [tipoActividad]
  )

  const [regionInicial, setRegionInicial] = useState(REGION_FALLBACK)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)
  const [fitRouteCoords, setFitRouteCoords] = useState<{ latitude: number; longitude: number }[] | null>(
    null
  )

  const [rutaOk, setRutaOk] = useState<OsrmRouteResult | null>(null)
  const [routeLineLatLng, setRouteLineLatLng] = useState<[number, number][] | null>(null)
  const [errorRuta, setErrorRuta] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)

  const [guardando, setGuardando] = useState(false)

  const [modoSeleccionMapa, setModoSeleccionMapa] = useState<{ waypointId: string } | null>(null)
  const [centroMapaPendiente, setCentroMapaPendiente] = useState<{ lat: number; lon: number } | null>(
    null
  )
  const [nameModalVisible, setNameModalVisible] = useState(false)
  const [nameModalInitial, setNameModalInitial] = useState('Punto en mapa')
  const [nameModalLoading, setNameModalLoading] = useState(false)
  const pendingPickRef = useRef<{ waypointId: string; lat: number; lon: number } | null>(null)

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

  useEffect(() => {
    let cancel = false
    async function cargarRutaExistente() {
      if (!viajeId || !userId?.trim()) {
        setCargandoRuta(false)
        return
      }
      setCargandoRuta(true)
      try {
        const ruta = await obtenerRuta(viajeId, userId.trim())
        if (cancel || !ruta) return

        const hydrated = waypointsFromRutaDetalle(ruta)
        setOrigen({ ...hydrated.origen, id: Crypto.randomUUID() })
        setDestino({ ...hydrated.destino, id: Crypto.randomUUID() })
        setParadas(hydrated.paradas.map((p) => ({ ...p, id: Crypto.randomUUID() })))
        setRouteLineLatLng(hydrated.routeLineLatLng)
        setFitRouteCoords(
          hydrated.routeLineLatLng.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
        )
        if (ruta.distancia_planeada_m != null && ruta.tiempo_estimado_seg != null) {
          setRutaOk({
            linestring: ruta.linestring,
            polylineLatLng: hydrated.routeLineLatLng,
            distanceM: ruta.distancia_planeada_m,
            durationSec: ruta.tiempo_estimado_seg,
          })
        }
      } catch {
        /* sin ruta previa o error de red */
      } finally {
        if (!cancel) setCargandoRuta(false)
      }
    }
    void cargarRutaExistente()
    return () => {
      cancel = true
    }
  }, [viajeId, userId])

  const waypointsOrdenados = useMemo(
    () => [origen, ...paradas, destino],
    [origen, paradas, destino]
  )

  const waypointsConCoords = useMemo(
    () => waypointsOrdenados.filter(waypointTieneCoords),
    [waypointsOrdenados]
  )

  useEffect(() => {
    if (modoSeleccionMapa) return

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
        setFitRouteCoords(
          res.polylineLatLng.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
        )
      } catch {
        if (cancel) return
        setRutaOk(null)
        setRouteLineLatLng(null)
        setErrorRuta('Sin conexión. No se pudo calcular la ruta.')
      } finally {
        if (!cancel) setCalculando(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [origen, destino, paradas, movilidad, waypointsConCoords, modoSeleccionMapa])

  const actualizarWaypoint = useCallback(
    (
      id: string,
      patch: Partial<Pick<RouteWaypoint, 'lat' | 'lon' | 'name' | 'category'>>
    ) => {
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
    },
    []
  )

  const agregarParada = useCallback(() => {
    setParadas((prev) => {
      if (prev.length >= MAX_PARADAS) {
        Alert.alert('Límite', `Máximo ${MAX_PARADAS} paradas intermedias.`)
        return prev
      }
      return [...prev, crearWaypoint('STOP', prev.length + 1)]
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

  const iniciarSeleccionMapa = useCallback(
    (waypointId: string) => {
      setModoSeleccionMapa({ waypointId })
      const wp = waypointsOrdenados.find((w) => w.id === waypointId)
      if (wp && waypointTieneCoords(wp)) {
        setCentroMapaPendiente({ lat: wp.lat, lon: wp.lon })
        setCameraTarget({ latitude: wp.lat, longitude: wp.lon })
      } else {
        setCentroMapaPendiente({
          lat: regionInicial.latitude,
          lon: regionInicial.longitude,
        })
      }
      sheetRef?.current?.snapToMin()
    },
    [waypointsOrdenados, regionInicial, sheetRef]
  )

  const cancelarSeleccionMapa = useCallback(() => {
    setModoSeleccionMapa(null)
    setCentroMapaPendiente(null)
    pendingPickRef.current = null
    sheetRef?.current?.snapToDefault()
  }, [sheetRef])

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (!modoSeleccionMapa) return
    setCentroMapaPendiente({ lat: region.latitude, lon: region.longitude })
  }, [modoSeleccionMapa])

  const confirmarCentroMapa = useCallback(async () => {
    if (!modoSeleccionMapa || !centroMapaPendiente) return

    pendingPickRef.current = {
      waypointId: modoSeleccionMapa.waypointId,
      lat: centroMapaPendiente.lat,
      lon: centroMapaPendiente.lon,
    }

    setNameModalVisible(true)
    setNameModalInitial('Punto en mapa')
    setNameModalLoading(true)

    try {
      const nombre = await reverseGeocode(centroMapaPendiente.lat, centroMapaPendiente.lon)
      setNameModalInitial(nombre)
    } catch {
      setNameModalInitial('Punto en mapa')
    } finally {
      setNameModalLoading(false)
    }
  }, [modoSeleccionMapa, centroMapaPendiente])

  const aplicarNombreMapa = useCallback(
    (name: string) => {
      const pending = pendingPickRef.current
      if (!pending) return

      actualizarWaypoint(pending.waypointId, {
        lat: pending.lat,
        lon: pending.lon,
        name,
      })

      pendingPickRef.current = null
      setModoSeleccionMapa(null)
      setCentroMapaPendiente(null)
      setNameModalVisible(false)
      sheetRef?.current?.snapToDefault()
    },
    [actualizarWaypoint, sheetRef]
  )

  const cancelarNombreMapa = useCallback(() => {
    setNameModalVisible(false)
    pendingPickRef.current = null
  }, [])

  const confirmarHabilitado =
    Boolean(viajeId) &&
    Boolean(userId?.trim()) &&
    waypointTieneCoords(origen) &&
    waypointTieneCoords(destino) &&
    paradas.every(waypointTieneCoords) &&
    Boolean(rutaOk) &&
    !calculando &&
    !guardando &&
    !modoSeleccionMapa

  const resumenDistancia = rutaOk ? formatDistance(rutaOk.distanceM) : null
  const resumenTiempo = rutaOk ? formatDuration(rutaOk.durationSec) : null

  const guardar = useCallback(async () => {
    if (!confirmarHabilitado || !rutaOk || !waypointTieneCoords(origen) || !waypointTieneCoords(destino)) {
      return
    }

    setGuardando(true)
    try {
      const body = toPutRutaBody(origen, paradas, destino, rutaOk)
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
    fitRouteCoords,
    routeLineLatLng,
    waypointsConCoords,
    calculando,
    cargandoRuta,
    errorRuta,
    resumenDistancia,
    resumenTiempo,
    confirmarHabilitado,
    guardando,
    modoSeleccionMapa,
    centroMapaPendiente,
    nameModalVisible,
    nameModalInitial,
    nameModalLoading,
    actualizarWaypoint,
    agregarParada,
    eliminarParada,
    moverParada,
    iniciarSeleccionMapa,
    cancelarSeleccionMapa,
    onRegionChangeComplete,
    confirmarCentroMapa,
    aplicarNombreMapa,
    cancelarNombreMapa,
    guardar,
  }
}
