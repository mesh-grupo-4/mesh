import { haversineDistanceM } from '@/lib/geo/haversine'

type LatLng = { lat: number; lng: number }

/** Índice del vértice más cercano y distancia perpendicular a la ruta (m). */
export function indiceMasCercanoEnRuta(
  ruta: [number, number][],
  pos: LatLng
): { indice: number; distanciaM: number } {
  if (ruta.length === 0) return { indice: 0, distanciaM: Infinity }
  if (ruta.length === 1) {
    const [lat, lng] = ruta[0]!
    return { indice: 0, distanciaM: haversineDistanceM(pos.lat, pos.lng, lat, lng) }
  }

  let mejorIndice = 0
  let mejorDist = Infinity

  for (let i = 0; i < ruta.length - 1; i++) {
    const [latA, lngA] = ruta[i]!
    const [latB, lngB] = ruta[i + 1]!
    const proy = proyectarEnSegmento(pos.lat, pos.lng, latA, lngA, latB, lngB)
    const d = haversineDistanceM(pos.lat, pos.lng, proy.lat, proy.lng)
    if (d < mejorDist) {
      mejorDist = d
      mejorIndice = proy.t >= 0.5 ? i + 1 : i
    }
  }

  return { indice: mejorIndice, distanciaM: mejorDist }
}

function proyectarEnSegmento(
  lat: number,
  lng: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): { lat: number; lng: number; t: number } {
  const dx = lngB - lngA
  const dy = latB - latA
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return { lat: latA, lng: lngA, t: 0 }
  let t = ((lng - lngA) * dx + (lat - latA) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { lat: latA + t * dy, lng: lngA + t * dx, t }
}

/** Parte la ruta planificada en tramo recorrido (atenuado) y tramo restante. */
export function dividirRutaPorAvance(
  ruta: [number, number][],
  pos: LatLng | null
): { recorrido: [number, number][]; restante: [number, number][] } {
  if (!ruta.length) return { recorrido: [], restante: [] }
  if (!pos) return { recorrido: [], restante: ruta }

  const { indice } = indiceMasCercanoEnRuta(ruta, pos)
  const recorrido: [number, number][] = ruta.slice(0, indice + 1)
  if (recorrido.length > 0) {
    recorrido.push([pos.lat, pos.lng])
  }
  const restante: [number, number][] =
    indice < ruta.length - 1 ? [[pos.lat, pos.lng], ...ruta.slice(indice + 1)] : []

  return { recorrido, restante }
}
