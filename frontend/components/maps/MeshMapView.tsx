import Constants from 'expo-constants'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps'

import type { MapStyleConfig } from '@/components/route-config/mapStyles'

/**
 * Mapa nativo de Google Maps (Maps SDK for Android/iOS vía react-native-maps).
 * Reemplaza al Leaflet embebido en WebView manteniendo la misma interfaz que
 * usaban las pantallas (marcadores, polilíneas, fitBounds/animateTo/panTo).
 *
 * En iOS se usa Google solo si el build tiene `GOOGLE_MAPS_IOS_API_KEY`
 * (ver `app.config.ts`); si no, cae a Apple Maps para no mostrar un mapa vacío.
 */

export type LatLng = { latitude: number; longitude: number }

export type MarkerSpec = {
  id: string
  lat: number
  lng: number
  /** Vista del marcador (se rasteriza a bitmap en el mapa nativo). */
  content: ReactElement
  /**
   * Cambia cada vez que cambia el aspecto del marcador. El SDK nativo cachea el
   * bitmap: sin esta clave los cambios de estado (detenido, incidente, viejo)
   * no se verían.
   */
  contentKey: string
  /** Punto de anclaje como fracción del tamaño (default: centro). */
  anchor?: { x: number; y: number }
  zIndex?: number
  popup?: { title: string; description?: string }
}

export type PolylineSpec = {
  coords: [number, number][]
  color: string
  width: number
  opacity?: number
  dashed?: boolean
}

export type EdgePadding = { top: number; right: number; bottom: number; left: number }

export type MeshMapViewHandle = {
  fitBounds: (coords: LatLng[], padding?: EdgePadding, animated?: boolean) => void
  animateTo: (center: LatLng, zoom?: number) => void
  /** Recentra sin tocar el zoom — para seguir al usuario sin "saltos" de escala. */
  panTo: (center: LatLng) => void
}

type Props = {
  initialCenter: LatLng
  initialZoom: number
  mapStyle: MapStyleConfig
  markers?: MarkerSpec[]
  polylines?: PolylineSpec[]
  /** Punto de "estoy acá" (GPS del dispositivo). */
  userLocation?: LatLng | null
  interactive?: boolean
  onReady?: () => void
  onRegionChangeComplete?: (center: LatLng) => void
  /** El usuario arrastró el mapa a mano (no una animación nuestra) — señal para pausar el "seguirme". */
  onUserDrag?: () => void
  style?: StyleProp<ViewStyle>
}

/** Color de acento de la app para el punto "estoy acá" (ver constants/Colors.ts). */
const COLOR_UBICACION = '#d76655'
const DURACION_ANIMACION_MS = 400
/** Tiempo que el marcador sigue redibujándose tras un cambio de aspecto. */
const MS_REDIBUJO_MARCADOR = 600

const usarGoogleEnIos = Boolean(Constants.expoConfig?.extra?.googleMapsIos)
const PROVIDER = Platform.OS === 'ios' && !usarGoogleEnIos ? PROVIDER_DEFAULT : PROVIDER_GOOGLE

/** Aproxima un zoom de Google Maps a partir de un `latitudeDelta`. */
export function zoomFromLatDelta(latitudeDelta: number): number {
  const z = Math.round(Math.log2(360 / latitudeDelta))
  return Math.min(19, Math.max(2, z))
}

function colorConOpacidad(hex: string, opacidad: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = Number.parseInt(m[1]!, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacidad})`
}

const MarcadorMapa = memo(function MarcadorMapa({ spec }: { spec: MarkerSpec }) {
  // Redibujar el bitmap solo un momento tras cada cambio de aspecto: dejar
  // `tracksViewChanges` siempre en true con 200 integrantes es muy costoso.
  const [redibujar, setRedibujar] = useState(true)
  useEffect(() => {
    setRedibujar(true)
    const t = setTimeout(() => setRedibujar(false), MS_REDIBUJO_MARCADOR)
    return () => clearTimeout(t)
  }, [spec.contentKey])

  return (
    <Marker
      coordinate={{ latitude: spec.lat, longitude: spec.lng }}
      anchor={spec.anchor ?? { x: 0.5, y: 0.5 }}
      zIndex={spec.zIndex ?? 0}
      tracksViewChanges={redibujar}
      title={spec.popup?.title}
      description={spec.popup?.description}
    >
      {spec.content}
    </Marker>
  )
})

export const MeshMapView = forwardRef<MeshMapViewHandle, Props>(function MeshMapView(
  {
    initialCenter,
    initialZoom,
    mapStyle,
    markers,
    polylines,
    userLocation = null,
    interactive = true,
    onReady,
    onRegionChangeComplete,
    onUserDrag,
    style,
  },
  ref
) {
  const mapRef = useRef<MapView>(null)
  const listoRef = useRef(false)
  // Última acción de cámara pedida antes de que el mapa esté listo: se aplica en onMapReady.
  const pendienteRef = useRef<(() => void) | null>(null)

  const initialCamera = useMemo(
    () => ({ center: initialCenter, zoom: initialZoom, heading: 0, pitch: 0 }),
    // La cámara inicial se fija una sola vez; después se mueve por el handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const ejecutar = useCallback((accion: () => void) => {
    if (listoRef.current) accion()
    else pendienteRef.current = accion
  }, [])

  useImperativeHandle(ref, () => ({
    fitBounds(coords, padding = { top: 40, right: 40, bottom: 40, left: 40 }, animated = true) {
      if (coords.length < 2) return
      ejecutar(() => mapRef.current?.fitToCoordinates(coords, { edgePadding: padding, animated }))
    },
    animateTo(center, zoom) {
      ejecutar(() =>
        mapRef.current?.animateCamera(zoom == null ? { center } : { center, zoom }, {
          duration: DURACION_ANIMACION_MS,
        })
      )
    },
    panTo(center) {
      ejecutar(() => mapRef.current?.animateCamera({ center }, { duration: DURACION_ANIMACION_MS }))
    },
  }))

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER}
        initialCamera={initialCamera}
        mapType={mapStyle.mapType}
        customMapStyle={mapStyle.customMapStyle ?? []}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={false}
        showsCompass={interactive}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        onMapReady={() => {
          listoRef.current = true
          const pendiente = pendienteRef.current
          pendienteRef.current = null
          pendiente?.()
          onReady?.()
        }}
        onRegionChangeStart={(_region, details) => {
          if (details?.isGesture) onUserDrag?.()
        }}
        onRegionChangeComplete={(region) =>
          onRegionChangeComplete?.({ latitude: region.latitude, longitude: region.longitude })
        }
      >
        {(polylines ?? [])
          .filter((pl) => pl.coords.length > 1)
          .map((pl, i) => (
            <Polyline
              key={`pl-${i}`}
              coordinates={pl.coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
              strokeColor={colorConOpacidad(pl.color, pl.opacity ?? 0.88)}
              strokeWidth={pl.width}
              lineDashPattern={pl.dashed ? [8, 10] : undefined}
              lineCap="round"
              lineJoin="round"
            />
          ))}

        {(markers ?? []).map((m) => (
          <MarcadorMapa key={m.id} spec={m} />
        ))}

        {userLocation ? (
          <MarcadorMapa
            spec={{
              id: '__ubicacion',
              lat: userLocation.latitude,
              lng: userLocation.longitude,
              content: (
                <View style={styles.ubicacionHalo}>
                  <View style={styles.ubicacionPunto} />
                </View>
              ),
              contentKey: 'ubicacion',
              zIndex: 2000,
            }}
          />
        ) : null}
      </MapView>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  ubicacionHalo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colorConOpacidad(COLOR_UBICACION, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ubicacionPunto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLOR_UBICACION,
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
})
