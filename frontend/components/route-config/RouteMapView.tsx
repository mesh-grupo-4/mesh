import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps'
import type { Region } from 'react-native-maps'

import { getMapStyle, type MapStyleId } from './mapStyles'
import {
  colorMarcador,
  ROUTE_POLYLINE_COLOR,
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
  onRegionChangeComplete?: (region: Region) => void
  calculando?: boolean
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
  },
  ref
) {
  const mapRef = useRef<MapView>(null)
  const capa = getMapStyle(mapStyle)

  useImperativeHandle(ref, () => ({
    fitRoute(coords) {
      if (!mapRef.current || coords.length < 2) return
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
        animated: true,
      })
    },
    focusPoint(target) {
      if (!mapRef.current) return
      mapRef.current.animateCamera(
        {
          center: target,
          zoom: 15,
        },
        { duration: 400 }
      )
    },
  }))

  useEffect(() => {
    if (!cameraTarget) return
    mapRef.current?.animateCamera({ center: cameraTarget, zoom: 15 }, { duration: 400 })
    onCameraTargetApplied?.()
  }, [cameraTarget, onCameraTargetApplied])

  useEffect(() => {
    if (mapPickMode) return
    const coords = fitRouteCoords ?? (routeLineLatLng?.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) ?? null)
    if (!coords || coords.length < 2) return
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
      animated: true,
    })
  }, [fitRouteCoords, routeLineLatLng, mapPickMode])

  const markers = waypoints.filter(waypointTieneCoords)

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android' && !mapPickMode}
        mapType={Platform.OS === 'android' ? 'none' : 'mutedStandard'}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        <UrlTile
          key={capa.id}
          urlTemplate={capa.urlTemplate}
          maximumZ={capa.maximumZ}
          flipY={capa.flipY}
          zIndex={-1}
        />
        {routeLineLatLng && routeLineLatLng.length > 1 && !mapPickMode ? (
          <Polyline
            coordinates={routeLineLatLng.map(([lat, lng]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor={ROUTE_POLYLINE_COLOR}
            strokeWidth={ROUTE_POLYLINE_WIDTH}
          />
        ) : null}
        {!mapPickMode
          ? markers.map((w) => (
              <Marker
                key={w.id}
                coordinate={{ latitude: w.lat, longitude: w.lon }}
                title={w.name || undefined}
                pinColor={colorMarcador(w.type)}
              />
            ))
          : null}
      </MapView>

      {calculando && !mapPickMode ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingTxt}>Calculando ruta…</Text>
        </View>
      ) : null}

      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionTxt} numberOfLines={1}>
          {capa.attribution}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  attribution: {
    position: 'absolute',
    left: 8,
    top: Platform.OS === 'ios' ? 96 : 72,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '55%',
  },
  attributionTxt: {
    fontSize: 10,
    color: '#374151',
  },
})
