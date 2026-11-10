import type { RouteWaypoint } from '@/components/route-config/routeTypes'
import { waypointTieneCoords } from '@/components/route-config/routeTypes'
import { linestringToLatLng } from './routePayload'
import type { RutaSnapshotPreviewApi } from './rutasCompartidasApi'

/**
 * Pasa una ruta planificada (snapshot de ruta compartida o plantilla guardada) a lo que
 * dibuja `RouteMapView`: waypoints (origen, paradas, destino) y la polilínea del trazado.
 */
export function snapshotToMap(preview: RutaSnapshotPreviewApi): {
  waypoints: RouteWaypoint[]
  routeLine: [number, number][]
} {
  const waypoints: RouteWaypoint[] = [
    {
      id: 'origen',
      type: 'ORIGIN',
      lat: preview.origen.lat,
      lon: preview.origen.lng,
      name: preview.origen.nombre ?? '',
      order: 0,
    },
    ...preview.paradas.map((p, i) => ({
      id: `parada-${i}`,
      type: 'STOP' as const,
      lat: p.lat,
      lon: p.lng,
      name: p.nombre ?? '',
      order: i + 1,
    })),
    {
      id: 'destino',
      type: 'DESTINATION',
      lat: preview.destino.lat,
      lon: preview.destino.lng,
      name: preview.destino.nombre ?? '',
      order: preview.paradas.length + 1,
    },
  ]
  return {
    waypoints,
    routeLine: linestringToLatLng(preview.linestring_geojson),
  }
}

/** Región inicial del mapa: el primer waypoint con coordenadas (Córdoba si no hay ninguno). */
export function regionInicialSnapshot(waypoints: RouteWaypoint[]) {
  const primero = waypoints.find(waypointTieneCoords)
  return {
    latitude: primero?.lat ?? -31.42,
    longitude: primero?.lon ?? -64.18,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  }
}

/** Puntos a encuadrar: el trazado si existe, si no los waypoints. */
export function coordsEncuadreSnapshot(mapa: {
  waypoints: RouteWaypoint[]
  routeLine: [number, number][]
}) {
  if (mapa.routeLine.length > 1) {
    return mapa.routeLine.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
  }
  return mapa.waypoints
    .filter(waypointTieneCoords)
    .map((w) => ({ latitude: w.lat, longitude: w.lon }))
}
