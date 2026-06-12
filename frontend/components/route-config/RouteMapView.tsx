import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps'

import { getMapStyle, type MapStyleId } from './mapStyles'
import { colorMarcador, type RouteWaypoint, waypointTieneCoords } from './routeTypes'
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
}

export const RouteMapView = forwardRef<RouteMapViewHandle, Props>(function RouteMapView(
  { waypoints, routeLineLatLng, mapStyle, initialRegion, cameraTarget, onCameraTargetApplied },
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
    if (!routeLineLatLng || routeLineLatLng.length < 2) return
    const coords = routeLineLatLng.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
      animated: true,
    })
  }, [routeLineLatLng])

  const markers = waypoints.filter(waypointTieneCoords)

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android'}
        mapType={Platform.OS === 'android' ? 'none' : 'mutedStandard'}
      >
        <UrlTile
          key={capa.id}
          urlTemplate={capa.urlTemplate}
          maximumZ={capa.maximumZ}
          flipY={capa.flipY}
          zIndex={-1}
        />
        {routeLineLatLng && routeLineLatLng.length > 1 ? (
          <Polyline
            coordinates={routeLineLatLng.map(([lat, lng]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor={capa.routeStrokeColor}
            strokeWidth={4}
          />
        ) : null}
        {markers.map((w) => (
          <Marker
            key={w.id}
            coordinate={{ latitude: w.lat, longitude: w.lon }}
            title={w.name || undefined}
            pinColor={colorMarcador(w.type)}
          />
        ))}
      </MapView>
      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionTxt} numberOfLines={1}>
          {capa.attribution}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
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
