import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import WebView from 'react-native-webview'

import { buildLeafletHtml, type LeafletTile } from './leafletHtml'

export type LatLng = { latitude: number; longitude: number }

export type MarkerSpec = {
  id: string
  lat: number
  lng: number
  html: string
  size?: [number, number]
  anchor?: [number, number]
  zIndexOffset?: number
  popup?: string
}

export type PolylineSpec = {
  coords: [number, number][]
  color: string
  width: number
  opacity?: number
  dashed?: boolean
}

export type EdgePadding = { top: number; right: number; bottom: number; left: number }

export type WebMapViewHandle = {
  fitBounds: (coords: LatLng[], padding?: EdgePadding, animated?: boolean) => void
  animateTo: (center: LatLng, zoom?: number) => void
}

type Props = {
  initialCenter: LatLng
  initialZoom: number
  tile: LeafletTile
  markers?: MarkerSpec[]
  polyline?: PolylineSpec | null
  polylines?: PolylineSpec[]
  /** Punto azul de "estoy acá" (GPS del dispositivo). */
  userLocation?: LatLng | null
  interactive?: boolean
  onReady?: () => void
  onRegionChangeComplete?: (center: LatLng) => void
  style?: StyleProp<ViewStyle>
}

/** Aproxima un zoom de Leaflet a partir del `latitudeDelta` que usaba react-native-maps. */
export function zoomFromLatDelta(latitudeDelta: number): number {
  const z = Math.round(Math.log2(360 / latitudeDelta))
  return Math.min(19, Math.max(2, z))
}

export const WebMapView = forwardRef<WebMapViewHandle, Props>(function WebMapView(
  {
    initialCenter,
    initialZoom,
    tile,
    markers,
    polyline,
    polylines,
    userLocation = null,
    interactive = true,
    onReady,
    onRegionChangeComplete,
    style,
  },
  ref
) {
  const webRef = useRef<WebView>(null)
  const [ready, setReady] = useState(false)
  const initialTileRef = useRef(tile)

  const html = useMemo(
    () =>
      buildLeafletHtml({
        centerLat: initialCenter.latitude,
        centerLng: initialCenter.longitude,
        zoom: initialZoom,
        tile: initialTileRef.current,
        interactive,
      }),
    // El HTML se genera una sola vez: el centro/zoom/tile iniciales no deben
    // recargar el WebView, se actualizan después por el bridge `window.__mesh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const run = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js}; true;`)
  }, [])

  useEffect(() => {
    if (!ready) return
    run(`window.__mesh.setMarkers(${JSON.stringify(markers ?? [])})`)
  }, [ready, markers, run])

  const lineasActivas = useMemo(() => {
    if (polylines && polylines.length > 0) return polylines
    return polyline ? [polyline] : []
  }, [polylines, polyline])

  useEffect(() => {
    if (!ready) return
    run(`window.__mesh.setPolylines(${JSON.stringify(lineasActivas)})`)
  }, [ready, lineasActivas, run])

  useEffect(() => {
    if (!ready) return
    run(
      `window.__mesh.setTileLayer(${JSON.stringify(tile.urlTemplate)}, ${tile.maximumZ}, ${tile.flipY}, ${JSON.stringify(tile.filter ?? null)})`
    )
  }, [ready, tile, run])

  useEffect(() => {
    if (!ready) return
    if (userLocation) {
      run(`window.__mesh.setUserLocation(${userLocation.latitude}, ${userLocation.longitude})`)
    } else {
      run('window.__mesh.clearUserLocation()')
    }
  }, [ready, userLocation, run])

  useImperativeHandle(ref, () => ({
    fitBounds(coords, padding = { top: 40, right: 40, bottom: 40, left: 40 }, animated = true) {
      if (!ready || coords.length < 2) return
      const latLngs = coords.map((c) => [c.latitude, c.longitude])
      run(`window.__mesh.fitBounds(${JSON.stringify(latLngs)}, ${JSON.stringify(padding)}, ${animated})`)
    },
    animateTo(center, zoom) {
      if (!ready) return
      run(`window.__mesh.animateTo(${center.latitude}, ${center.longitude}, ${zoom ?? 'null'})`)
    },
  }))

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data) as
              | { type: 'ready' }
              | { type: 'regionChangeComplete'; lat: number; lng: number }
            if (msg.type === 'ready') {
              setReady(true)
              onReady?.()
              return
            }
            if (msg.type === 'regionChangeComplete') {
              onRegionChangeComplete?.({ latitude: msg.lat, longitude: msg.lng })
            }
          } catch {
            /* ignorar mensajes malformados */
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#e5e7eb' },
})
