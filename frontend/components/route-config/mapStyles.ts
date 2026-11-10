import type { MapStyleElement, MapType } from 'react-native-maps'

export type MapStyleId = 'standard' | 'dark' | 'satellite' | 'terrain'

export type MapStyleConfig = {
  id: MapStyleId
  label: string
  /** Nombre de ícono Feather (@expo/vector-icons) */
  icon: 'map' | 'moon' | 'globe' | 'layers'
  /** Tipo de mapa base de Google Maps (Maps SDK for Android/iOS). */
  mapType: MapType
  /** Estilo JSON de Google Maps aplicado sobre `mapType: 'standard'`. */
  customMapStyle?: MapStyleElement[]
  routeStrokeColor: string
}

/** Estilo "noche" de Google Maps (paleta oficial de ejemplo de la documentación). */
const ESTILO_OSCURO: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
]

/** Capas base de Google Maps. La atribución la dibuja el propio SDK (logo de Google). */
export const MAP_STYLES: MapStyleConfig[] = [
  {
    id: 'standard',
    label: 'Mapa',
    icon: 'map',
    mapType: 'standard',
    routeStrokeColor: '#2563eb',
  },
  {
    id: 'dark',
    label: 'Oscuro',
    icon: 'moon',
    mapType: 'standard',
    customMapStyle: ESTILO_OSCURO,
    routeStrokeColor: '#60a5fa',
  },
  {
    id: 'satellite',
    label: 'Satélite',
    icon: 'globe',
    // Híbrido: imagen satelital con nombres de calles, más útil para orientarse.
    mapType: 'hybrid',
    routeStrokeColor: '#fbbf24',
  },
  {
    id: 'terrain',
    label: 'Terreno',
    icon: 'layers',
    mapType: 'terrain',
    routeStrokeColor: '#dc2626',
  },
]

export function getMapStyle(id: MapStyleId): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]
}
