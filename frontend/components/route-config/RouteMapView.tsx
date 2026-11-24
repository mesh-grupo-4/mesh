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
import { BotonEncuadrar } from '@/components/maps/BotonEncuadrar'
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
  /** Botón abajo a la derecha que vuelve a encuadrar la ruta (miniaturas). */
  botonEncuadrar?: boolean
  /** Capa transparente sobre el mapa que se come los gestos (el toque lo maneja el padre); el botón queda encima. */
  bloquearGestos?: boolean
  /**
   * Miniatura de lista: mapa lite sin gestos (ver `MeshMapView`), encuadre sin animación y
   * puntos chicos en lugar de pines, que en un cuadro de 100 px taparían la ruta.
   */
  miniatura?: boolean
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
    botonEncuadrar = false,
    bloquearGestos = false,
    miniatura = false,
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

  const coordsEncuadre = useMemo(
    () =>
      fitRouteCoords ??
      routeLineLatLng?.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) ??
      null,
    [fitRouteCoords, routeLineLatLng]
  )
  const puedeEncuadrar = !mapPickMode && coordsEncuadre != null && coordsEncuadre.length > 1

  useEffect(() => {
    if (!puedeEncuadrar) return
    // El modo lite no anima la cámara: en la miniatura el encuadre va directo.
    mapRef.current?.fitBounds(coordsEncuadre!, padding, !miniatura)
  }, [coordsEncuadre, puedeEncuadrar, padding, miniatura])

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
    return waypoints.filter(waypointTieneCoords).map((w) => {
      const color = colorMarcador(w.type, theme)
      return miniatura
        ? {
            id: w.id,
            lat: w.lat,
            lng: w.lon,
            content: <View style={[styles.puntoMiniatura, { backgroundColor: color }]} />,
            contentKey: `mini-${color}`,
          }
        : {
            id: w.id,
            lat: w.lat,
            lng: w.lon,
            content: <PinMarker color={color} />,
            contentKey: color,
            anchor: PIN_ANCHOR,
            popup: w.name ? { title: w.name } : undefined,
          }
    })
  }, [waypoints, mapPickMode, theme, miniatura])

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
        liteMode={miniatura}
        interactive={!miniatura}
      />
      {bloquearGestos ? <View style={StyleSheet.absoluteFill} /> : null}
      {botonEncuadrar && puedeEncuadrar ? (
        <BotonEncuadrar onPress={() => mapRef.current?.fitBounds(coordsEncuadre!, padding, true)} />
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  puntoMiniatura: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
})
