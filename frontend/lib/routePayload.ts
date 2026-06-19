import type { OsrmRouteResult } from '@/lib/osrm'
import type { CategoriaParada, GeoJsonLineString, PutRutaBody, RutaDetalleApi } from '@/lib/viajesTypes'

import type { RouteWaypoint, StopCategory } from '@/components/route-config/routeTypes'
import { waypointTieneCoords } from '@/components/route-config/routeTypes'

export type RoutePointPayload = {
  type: 'ORIGIN' | 'STOP' | 'DESTINATION'
  lat: number
  lon: number
  name: string
  category: string | null
  order: number
}

const CATEGORY_TO_API: Record<StopCategory, CategoriaParada> = {
  kiosco: 'kiosco',
  gastronomia: 'gastronomia',
  combustible: 'combustible',
  descanso: 'descanso',
  punto_control: 'punto_control',
  otro: 'otro',
}

const CATEGORY_TO_UI: Record<CategoriaParada, StopCategory> = {
  kiosco: 'kiosco',
  combustible: 'combustible',
  descanso: 'descanso',
  gastronomia: 'gastronomia',
  punto_control: 'punto_control',
  sanitario: 'otro',
  otro: 'otro',
}

export function categoryToApi(category: StopCategory | null | undefined): CategoriaParada {
  if (!category) return 'otro'
  return CATEGORY_TO_API[category] ?? 'otro'
}

export function categoryFromApi(categoria: CategoriaParada): StopCategory {
  return CATEGORY_TO_UI[categoria] ?? 'otro'
}

export function categoryToPayloadLabel(category: StopCategory | null | undefined): string | null {
  if (!category) return null
  return category.toUpperCase()
}

export function buildRoutePointsPayload(
  origen: RouteWaypoint,
  paradas: RouteWaypoint[],
  destino: RouteWaypoint
): RoutePointPayload[] {
  const points: RoutePointPayload[] = []

  if (waypointTieneCoords(origen)) {
    points.push({
      type: 'ORIGIN',
      lat: origen.lat,
      lon: origen.lon,
      name: origen.name || 'Origen',
      category: null,
      order: 0,
    })
  }

  paradas.filter(waypointTieneCoords).forEach((p, i) => {
    points.push({
      type: 'STOP',
      lat: p.lat,
      lon: p.lon,
      name: p.name || `Parada ${i + 1}`,
      category: categoryToPayloadLabel(p.category),
      order: i + 1,
    })
  })

  if (waypointTieneCoords(destino)) {
    points.push({
      type: 'DESTINATION',
      lat: destino.lat,
      lon: destino.lon,
      name: destino.name || 'Destino',
      category: null,
      order: paradas.length + 1,
    })
  }

  return points
}

export function toPutRutaBody(
  origen: RouteWaypoint,
  paradas: RouteWaypoint[],
  destino: RouteWaypoint,
  osrmResult: OsrmRouteResult
): PutRutaBody {
  if (!waypointTieneCoords(origen) || !waypointTieneCoords(destino)) {
    throw new Error('Origen y destino son obligatorios')
  }

  return {
    origen: { type: 'Point', coordinates: [origen.lon, origen.lat] },
    destino: { type: 'Point', coordinates: [destino.lon, destino.lat] },
    origenNombre: origen.name.trim() || null,
    destinoNombre: destino.name.trim() || null,
    linestring: osrmResult.linestring,
    tiempoEstimadoSeg: Math.round(osrmResult.durationSec),
    paradas: paradas.filter(waypointTieneCoords).map((p, i) => ({
      orden: i,
      lat: p.lat,
      lng: p.lon,
      nombre: p.name.trim() || null,
      categoria: categoryToApi(p.category),
    })),
  }
}

export function linestringToLatLng(linestring: GeoJsonLineString): [number, number][] {
  return linestring.coordinates.map(([lng, lat]) => [lat, lng])
}

export function waypointsFromRutaDetalle(ruta: RutaDetalleApi): {
  origen: Omit<RouteWaypoint, 'id'>
  paradas: Omit<RouteWaypoint, 'id'>[]
  destino: Omit<RouteWaypoint, 'id'>
  routeLineLatLng: [number, number][]
} {
  const paradas = ruta.paradas.map((p) => ({
    type: 'STOP' as const,
    lat: p.lat,
    lon: p.lng,
    name: p.nombre ?? '',
    category: categoryFromApi(p.categoria),
    order: p.orden + 1,
  }))

  return {
    origen: {
      type: 'ORIGIN',
      lat: ruta.origen.lat,
      lon: ruta.origen.lng,
      name: ruta.origen.nombre ?? '',
      category: null,
      order: 0,
    },
    paradas,
    destino: {
      type: 'DESTINATION',
      lat: ruta.destino.lat,
      lon: ruta.destino.lng,
      name: ruta.destino.nombre ?? '',
      category: null,
      order: paradas.length + 1,
    },
    routeLineLatLng: linestringToLatLng(ruta.linestring),
  }
}
