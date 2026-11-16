import { useEffect, useMemo, useRef } from 'react'
import { Feather } from '@expo/vector-icons'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import { BotonEncuadrar } from '@/components/maps/BotonEncuadrar'
import { MeshMapView, zoomFromLatDelta, type MeshMapViewHandle, type MarkerSpec } from '@/components/maps/MeshMapView'
import { PinMarker, PIN_ANCHOR } from '@/components/maps/PinMarker'
import { getMapStyle } from '@/components/route-config/mapStyles'
import { useCapaMapa } from '@/hooks/useCapaMapa'

/**
 * US2: dibuja la traza GPS realmente recorrida en un viaje finalizado.
 * Google Maps nativo (`MeshMapView`), igual que el resto de los mapas de la app.
 *
 * `segmentos` viene partido en tramos contiguos (un hueco de señal largo o un
 * salto de posición imposible entre pings corta la traza en un tramo nuevo): cada
 * tramo se dibuja como su propia polilínea, para no conectar dos tramos con una
 * línea recta que atraviese el mapa.
 */
type Props = {
  segmentos: [number, number][][]
  cargando?: boolean
  altura?: number
  /** Ocupa todo el alto disponible, sin esquinas redondeadas (pantalla de recorrido). */
  completo?: boolean
  /** En false el mapa no toma los gestos: la tarjeta que lo contiene recibe el toque. */
  interactivo?: boolean
  /** Muestra un botón para abrir el recorrido a pantalla completa. */
  onExpandir?: () => void
}

const PADDING_FIT = { top: 40, right: 40, bottom: 40, left: 40 }

export function RecorridoMapView({
  segmentos,
  cargando = false,
  altura = 220,
  completo = false,
  interactivo = true,
  onExpandir,
}: Props) {
  const theme = useTheme()
  const mapRef = useRef<MeshMapViewHandle>(null)
  const [capaElegida] = useCapaMapa()
  const capa = getMapStyle(capaElegida)
  const puntos = useMemo(() => segmentos.flat(), [segmentos])
  const hayTraza = puntos.length > 1
  const tamano = completo ? styles.completo : [styles.caja, { height: altura }]
  const coordsFit = useMemo(
    () => puntos.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
    [puntos]
  )

  useEffect(() => {
    if (!hayTraza) return
    // Si el mapa todavía no está listo, MeshMapView aplica el fit en onMapReady.
    mapRef.current?.fitBounds(coordsFit, PADDING_FIT, false)
  }, [coordsFit, hayTraza])

  const polylines = useMemo(
    () =>
      segmentos
        .filter((tramo) => tramo.length > 1)
        .map((tramo) => ({ coords: tramo, color: theme.accent, width: 4 })),
    [segmentos, theme.accent]
  )

  const markers = useMemo<MarkerSpec[]>(() => {
    if (!hayTraza) return []
    const inicio = puntos[0]!
    const fin = puntos[puntos.length - 1]!
    return [
      {
        id: 'inicio',
        lat: inicio[0],
        lng: inicio[1],
        content: <PinMarker color="#15803d" />,
        contentKey: 'inicio',
        anchor: PIN_ANCHOR,
        popup: { title: 'Inicio' },
      },
      {
        id: 'fin',
        lat: fin[0],
        lng: fin[1],
        content: <PinMarker color="#dc2626" />,
        contentKey: 'fin',
        anchor: PIN_ANCHOR,
        popup: { title: 'Fin' },
      },
    ]
  }, [puntos, hayTraza])

  if (cargando) {
    return (
      <View style={[tamano, styles.centro, { backgroundColor: theme.surface2 }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  if (!hayTraza) {
    return (
      <View style={[tamano, styles.centro, { backgroundColor: theme.surface2 }]}>
        <Text style={[styles.vacio, { color: theme.textMute }]}>
          Este viaje no tiene traza GPS registrada.
        </Text>
      </View>
    )
  }

  const inicio = puntos[0]!

  return (
    <View style={tamano} pointerEvents={interactivo ? 'auto' : 'none'}>
      <MeshMapView
        ref={mapRef}
        initialCenter={{ latitude: inicio[0], longitude: inicio[1] }}
        initialZoom={zoomFromLatDelta(0.08)}
        mapStyle={capa}
        markers={markers}
        polylines={polylines}
        interactive={interactivo}
      />
      {onExpandir ? (
        <Pressable
          onPress={onExpandir}
          hitSlop={8}
          style={({ pressed }) => [styles.expandir, pressed && styles.presionado]}
          accessibilityRole="button"
          accessibilityLabel="Abrir el mapa a pantalla completa"
        >
          <Feather name="maximize-2" size={18} color="#111827" />
        </Pressable>
      ) : null}
      {interactivo ? (
        <BotonEncuadrar onPress={() => mapRef.current?.fitBounds(coordsFit, PADDING_FIT, true)} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  caja: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  completo: { flex: 1 },
  expandir: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  presionado: { opacity: 0.7 },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacio: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
