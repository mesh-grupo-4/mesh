import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import WebView from 'react-native-webview'
import { buildLeafletRouteHtml } from './leafletHtml'

export type RouteMapWaypoint = { lat: number; lng: number; label: string }

type NativeMsg =
  | { type: 'ready' }
  | { type: 'longpress'; lat: number; lng: number }

type Props = {
  waypoints: RouteMapWaypoint[]
  /** Polilínea en orden Leaflet [lat, lng][] */
  routeLineLatLng: [number, number][] | null
  onLongPressMap: (lat: number, lng: number) => void
}

const html = buildLeafletRouteHtml()

export function RouteMapWebView({ waypoints, routeLineLatLng, onLongPressMap }: Props) {
  const ref = useRef<WebView>(null)
  const [bridgeReady, setBridgeReady] = useState(false)

  const pushState = useCallback(() => {
    if (!ref.current || !bridgeReady) return
    const payload = {
      waypoints,
      routeLine: routeLineLatLng && routeLineLatLng.length > 1 ? routeLineLatLng : null,
    }
    const js = `window.__meshApply(${JSON.stringify(payload)}); true;`
    ref.current.injectJavaScript(js)
  }, [bridgeReady, waypoints, routeLineLatLng])

  useEffect(() => {
    pushState()
  }, [pushState])

  return (
    <View style={styles.wrap}>
      <WebView
        ref={ref}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data) as NativeMsg
            if (msg.type === 'ready') {
              setBridgeReady(true)
              return
            }
            if (msg.type === 'longpress') {
              onLongPressMap(msg.lat, msg.lng)
            }
          } catch {
            /* ignorar */
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
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#e5e7eb' },
})
