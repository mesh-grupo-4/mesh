export type MapStyleId = 'standard' | 'dark' | 'satellite' | 'terrain'

export type MapStyleConfig = {
  id: MapStyleId
  label: string
  /** Nombre de ícono Feather (@expo/vector-icons) */
  icon: 'map' | 'moon' | 'globe' | 'layers'
  urlTemplate: string
  maximumZ: number
  flipY: boolean
  routeStrokeColor: string
  attribution: string
  /** Filtro CSS aplicado sobre las teselas en el WebView (ver leafletHtml.ts). */
  filter?: 'dark'
}

/** Capas de teselas open source — sin APIs comerciales (Google/Mapbox). */
export const MAP_STYLES: MapStyleConfig[] = [
  {
    id: 'standard',
    label: 'Mapa',
    icon: 'map',
    // CARTO (basemaps.cartocdn.com) exige API key desde 2025 y sin ella
    // devuelve una tesela fija con "API key required" — se usa el tile server
    // oficial de OSM en su lugar.
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumZ: 19,
    flipY: false,
    routeStrokeColor: '#2563eb',
    attribution: '© OpenStreetMap contributors',
  },
  {
    id: 'dark',
    label: 'Oscuro',
    icon: 'moon',
    // Mismo tile server que "standard": el modo oscuro se logra con un filtro
    // CSS (ver leafletHtml.ts) porque no existe un tile server OSM oscuro
    // gratuito sin API key.
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumZ: 19,
    flipY: false,
    routeStrokeColor: '#60a5fa',
    attribution: '© OpenStreetMap contributors',
    filter: 'dark',
  },
  {
    id: 'satellite',
    label: 'Satélite',
    icon: 'globe',
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumZ: 19,
    flipY: false,
    routeStrokeColor: '#fbbf24',
    attribution: '© Esri · © OpenStreetMap',
  },
  {
    id: 'terrain',
    label: 'Terreno',
    icon: 'layers',
    urlTemplate: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    maximumZ: 17,
    flipY: false,
    routeStrokeColor: '#dc2626',
    attribution: '© OpenTopoMap · © OpenStreetMap',
  },
]

export function getMapStyle(id: MapStyleId): MapStyleConfig {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]
}
