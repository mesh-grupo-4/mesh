import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { WebMapView, zoomFromLatDelta, type WebMapViewHandle, type MarkerSpec, type LatLng } from '@/components/maps/WebMapView'
import { pinMarkerHtml, PIN_SIZE, PIN_ANCHOR } from '@/components/maps/pinMarker'

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
  mapStyle: MapStyleId
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
  calculando?: boolean
  /** Padding inferior al ajustar la ruta (default 280 del editor). */
  fitBottomPadding?: number
}

export const RouteMapView = forwardRef<RouteMapViewHandle, Props>(function RouteMapView(
  {
    waypoints,
    routeLineLatLng,
    mapStyle,
    initialRegion,
    cameraTarget,
    onCameraTargetApplied,
    fitRouteCoords,
    mapPickMode = false,
    onRegionChangeComplete,
    calculando = false,
    fitBottomPadding = 280,
  },
  ref
) {
  const theme = useTheme()
  const mapRef = useRef<WebMapViewHandle>(null)
  const capa = getMapStyle(mapStyle)

  useImperativeHandle(ref, () => ({
    fitRoute(coords) {
      if (coords.length < 2) return
      mapRef.current?.fitBounds(coords, { top: 80, right: 40, bottom: fitBottomPadding, left: 40 }, true)
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
    mapRef.current?.fitBounds(coords, { top: 80, right: 40, bottom: fitBottomPadding, left: 40 }, true)
  }, [fitRouteCoords, routeLineLatLng, mapPickMode, fitBottomPadding])

  const markers = useMemo<MarkerSpec[]>(() => {
    if (mapPickMode) return []
    return waypoints.filter(waypointTieneCoords).map((w) => ({
      id: w.id,
      lat: w.lat,
      lng: w.lon,
      html: pinMarkerHtml(colorMarcador(w.type, theme)),
      size: PIN_SIZE,
      anchor: PIN_ANCHOR,
      popup: w.name || undefined,
    }))
  }, [waypoints, mapPickMode, theme])

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <WebMapView
        ref={mapRef}
        initialCenter={{ latitude: initialRegion.latitude, longitude: initialRegion.longitude }}
        initialZoom={zoomFromLatDelta(initialRegion.latitudeDelta)}
        tile={capa}
        markers={markers}
        polyline={
          routeLineLatLng && routeLineLatLng.length > 1 && !mapPickMode
            ? { coords: routeLineLatLng, color: theme.accent, width: ROUTE_POLYLINE_WIDTH }
            : null
        }
        onRegionChangeComplete={onRegionChangeComplete}
      />

      {calculando && !mapPickMode ? (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.scrim }]} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingTxt, { color: theme.text }]}>Calculando ruta…</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.attribution,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.attributionTxt, { color: theme.textDim }]} numberOfLines={1}>
          {capa.attribution}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingTxt: {
    fontSize: 15,
    fontWeight: '600',
  },
  attribution: {
    position: 'absolute',
    left: 8,
    top: Platform.OS === 'ios' ? 96 : 72,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '55%',
  },
  attributionTxt: {
    fontSize: 10,
  },
})
