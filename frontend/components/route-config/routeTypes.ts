export type RouteWaypointType = 'ORIGIN' | 'STOP' | 'DESTINATION'

export type StopCategory =
  | 'kiosco'
  | 'gastronomia'
  | 'combustible'
  | 'descanso'
  | 'punto_control'
  | 'otro'

export type RouteWaypoint = {
  id: string
  type: RouteWaypointType
  lat: number | null
  lon: number | null
  name: string
  category?: StopCategory | null
  order: number
}

export function waypointTieneCoords(w: RouteWaypoint): w is RouteWaypoint & { lat: number; lon: number } {
  return w.lat != null && w.lon != null && !Number.isNaN(w.lat) && !Number.isNaN(w.lon)
}

export function labelTipoWaypoint(type: RouteWaypointType): string {
  switch (type) {
    case 'ORIGIN':
      return 'Origen'
    case 'STOP':
      return 'Parada'
    case 'DESTINATION':
      return 'Destino'
  }
}

export function colorMarcador(type: RouteWaypointType): string {
  switch (type) {
    case 'ORIGIN':
      return '#15803d'
    case 'STOP':
      return '#ca8a04'
    case 'DESTINATION':
      return '#b91c1c'
  }
}

/** Córdoba, Argentina — fallback si no hay permiso de ubicación. */
export const REGION_FALLBACK = {
  latitude: -31.4201,
  longitude: -64.1888,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

export const ROUTE_POLYLINE_COLOR = '#6366f1'
export const ROUTE_POLYLINE_WIDTH = 5
