import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import {
  MeshMapView,
  zoomFromLatDelta,
  type MeshMapViewHandle,
  type MarkerSpec,
  type PolylineSpec,
  type LatLng,
} from '@/components/maps/MeshMapView'
import { PinMarker, PIN_ANCHOR } from '@/components/maps/PinMarker'
import { useCapaMapa } from '@/hooks/useCapaMapa'

import { getMapStyle, type MapStyleId } from './mapStyles'
import {
  colorMarcador,
  ROUTE_POLYLINE_WIDTH,
  type RouteWaypoint,
  waypointTieneCoords,
} from './routeTypes'
import type { CameraTarget } from './useRoutePlanner'

export type RouteMapViewHandle = {
  fitRoute: (coords: { latitude: number; longitude: number }[]) => void
  focusPoint: (target: CameraTarget) => void
}

type Props = {
  waypoints: RouteWaypoint[]
  routeLineLatLng: [number, number][] | null
  /** Línea recta punteada entre waypoints mientras no hay ruta calculada (OSRM aún no respondió o falló). */
  previewLineLatLng?: [number, number][] | null
  /** Si no se pasa, usa la vista de mapa elegida por el usuario. */
  mapStyle?: MapStyleId
  initialRegion: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
  cameraTarget: CameraTarget | null
  onCameraTargetApplied?: () => void
  fitRouteCoords?: { latitude: number; longitude: number }[] | null
  mapPickMode?: boolean
  onRegionChangeComplete?: (region: LatLng) => void
  /** Padding inferior al ajustar la ruta (default 280 del editor). */
  fitBottomPadding?: number
  /** Márgenes completos al ajustar la ruta; reemplaza los del editor (p. ej. en una miniatura). */
  fitPadding?: { top: number; right: number; bottom: number; left: number }
  /** Ubicación GPS actual del usuario. */
  userLocation?: { latitude: number; longitude: number } | null
}

export const RouteMapView = forwardRef<RouteMapViewHandle, Props>(function RouteMapView(
  {
    waypoints,
    routeLineLatLng,
    previewLineLatLng = null,
    mapStyle,
    initialRegion,
    cameraTarget,
    onCameraTargetApplied,
    fitRouteCoords,
    mapPickMode = false,
    onRegionChangeComplete,
    fitBottomPadding = 280,
    fitPadding,
    userLocation = null,
  },
  ref
) {
  const theme = useTheme()
  const mapRef = useRef<MeshMapViewHandle>(null)
  const [capaElegida] = useCapaMapa()
  const capa = getMapStyle(mapStyle ?? capaElegida)
  const padding = useMemo(
    () => fitPadding ?? { top: 80, right: 40, bottom: fitBottomPadding, left: 40 },
    [fitPadding, fitBottomPadding]
  )

  useImperativeHandle(ref, () => ({
    fitRoute(coords) {
      if (coords.length < 2) return
      mapRef.current?.fitBounds(coords, padding, true)
    },
    focusPoint(target) {
      mapRef.current?.animateTo(target, 15)
    },
  }))

  useEffect(() => {
    if (!cameraTarget) return
    mapRef.current?.animateTo(cameraTarget, 15)
    onCameraTargetApplied?.()
  }, [cameraTarget, onCameraTargetApplied])

  useEffect(() => {
    if (mapPickMode) return
    const coords = fitRouteCoords ?? (routeLineLatLng?.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) ?? null)
    if (!coords || coords.length < 2) return
    mapRef.current?.fitBounds(coords, padding, true)
  }, [fitRouteCoords, routeLineLatLng, mapPickMode, padding])

  const polylines = useMemo((): PolylineSpec[] => {
    if (mapPickMode) return []
    if (routeLineLatLng && routeLineLatLng.length > 1) {
      return [
        {
          coords: routeLineLatLng,
          color: capa.routeStrokeColor,
          width: ROUTE_POLYLINE_WIDTH,
          opacity: 0.95,
        },
      ]
    }
    if (previewLineLatLng && previewLineLatLng.length > 1) {
      return [
        {
          coords: previewLineLatLng,
          color: capa.routeStrokeColor,
          width: 3,
          opacity: 0.55,
          dashed: true,
        },
      ]
    }
    return []
  }, [mapPickMode, routeLineLatLng, previewLineLatLng, capa.routeStrokeColor])

  const markers = useMemo<MarkerSpec[]>(() => {
    if (mapPickMode) return []
    return waypoints.filter(waypointTieneCoords).map((w) => ({
      id: w.id,
      lat: w.lat,
      lng: w.lon,
      content: <PinMarker color={colorMarcador(w.type, theme)} />,
      contentKey: colorMarcador(w.type, theme),
      anchor: PIN_ANCHOR,
      popup: w.name ? { title: w.name } : undefined,
    }))
  }, [waypoints, mapPickMode, theme])

  return (
    <View style={StyleSheet.absoluteFill}>
      <MeshMapView
        ref={mapRef}
        initialCenter={{ latitude: initialRegion.latitude, longitude: initialRegion.longitude }}
        initialZoom={zoomFromLatDelta(initialRegion.latitudeDelta)}
        mapStyle={capa}
        markers={markers}
        polylines={polylines}
        userLocation={userLocation}
        onRegionChangeComplete={onRegionChangeComplete}
      />
    </View>
  )
})
