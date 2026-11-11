import { haversineDistanceM } from '@/lib/geo/haversine'

type LatLng = { lat: number; lng: number }

const METROS_POR_GRADO = 111320
/**
 * Dos tramos cuya distancia a la posición difiere en menos que esto se consideran
 * "el mismo lugar" (ida y vuelta por la misma ruta, manos de una autopista): entre
 * ellos se elige por continuidad con el avance previo, no por cuál quedó más cerca.
 */
const TOLERANCIA_TRAMO_M = 25
/** Hasta esta distancia de la ruta, el tramo restante arranca en tu posición. */
const PEGADO_A_RUTA_M = 40

/** Ruta planificada con las distancias acumuladas ya calculadas (se arma una sola vez). */
export type RutaPreparada = {
  coords: [number, number][]
  /** Metros desde el inicio hasta cada vértice. */
  acumuladoM: Float64Array
  totalM: number
  /** Metros por grado de longitud a la latitud de cada vértice. */
  metrosPorGradoLng: Float64Array
}

/** Dónde cae una posición sobre la ruta. */
export type AvanceRuta = {
  /** Metros recorridos sobre la ruta, desde su inicio. */
  progresoM: number
  totalM: number
  /** Distancia en metros entre la posición y la ruta. */
  distanciaARutaM: number
  /** Tramo `[segmento, segmento + 1]` sobre el que cae la proyección. */
  segmento: number
  punto: LatLng
}

export function prepararRuta(coords: [number, number][]): RutaPreparada {
  const n = coords.length
  const acumuladoM = new Float64Array(n)
  const metrosPorGradoLng = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const [lat, lng] = coords[i]!
    metrosPorGradoLng[i] = METROS_POR_GRADO * Math.cos((lat * Math.PI) / 180)
    if (i > 0) {
      const [latA, lngA] = coords[i - 1]!
      acumuladoM[i] = acumuladoM[i - 1]! + haversineDistanceM(latA, lngA, lat, lng)
    }
  }
  return { coords, acumuladoM, totalM: n > 0 ? acumuladoM[n - 1]! : 0, metrosPorGradoLng }
}

/**
 * Proyecta una posición sobre la ruta.
 *
 * `pistaM` es el avance que se conocía hasta ahora: cuando la ruta pasa dos veces
 * por el mismo lugar (ida y vuelta, circuito que cierra donde empezó) decide de
 * cuál de las pasadas se trata. Sin pista se elige el tramo más cercano y, a igual
 * distancia, el primero.
 */
export function avanzarEnRuta(
  ruta: RutaPreparada,
  pos: LatLng,
  pistaM: number | null = null
): AvanceRuta | null {
  const { coords, acumuladoM, metrosPorGradoLng, totalM } = ruta
  const n = coords.length
  if (n === 0) return null
  if (n === 1) {
    const [lat, lng] = coords[0]!
    return {
      progresoM: 0,
      totalM,
      distanciaARutaM: haversineDistanceM(pos.lat, pos.lng, lat, lng),
      segmento: 0,
      punto: { lat, lng },
    }
  }

  let minimaM = Infinity
  for (let i = 0; i < n - 1; i++) {
    const d = distanciaAlTramoM(coords, metrosPorGradoLng, i, pos).d
    if (d < minimaM) minimaM = d
  }

  const limiteM = minimaM + TOLERANCIA_TRAMO_M
  let mejor: AvanceRuta | null = null
  let mejorCosto = Infinity
  for (let i = 0; i < n - 1; i++) {
    const { d, t } = distanciaAlTramoM(coords, metrosPorGradoLng, i, pos)
    if (d > limiteM) continue
    const progresoM = acumuladoM[i]! + t * (acumuladoM[i + 1]! - acumuladoM[i]!)
    const costo = pistaM == null ? d : Math.abs(progresoM - pistaM)
    if (costo >= mejorCosto) continue
    mejorCosto = costo
    const [latA, lngA] = coords[i]!
    const [latB, lngB] = coords[i + 1]!
    mejor = {
      progresoM,
      totalM,
      distanciaARutaM: d,
      segmento: i,
      punto: { lat: latA + t * (latB - latA), lng: lngA + t * (lngB - lngA) },
    }
  }
  return mejor
}

/** Distancia (plano local, en metros) de una posición al tramo `i` de la ruta. */
function distanciaAlTramoM(
  coords: [number, number][],
  metrosPorGradoLng: Float64Array,
  i: number,
  pos: LatLng
): { d: number; t: number } {
  const [latA, lngA] = coords[i]!
  const [latB, lngB] = coords[i + 1]!
  const kx = metrosPorGradoLng[i]!
  const bx = (lngB - lngA) * kx
  const by = (latB - latA) * METROS_POR_GRADO
  const px = (pos.lng - lngA) * kx
  const py = (pos.lat - latA) * METROS_POR_GRADO
  const largo2 = bx * bx + by * by
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / largo2))
  const dx = px - t * bx
  const dy = py - t * by
  return { d: Math.sqrt(dx * dx + dy * dy), t }
}

/**
 * Tramo de la ruta que falta recorrer. Arranca en tu posición si venís sobre la
 * ruta; si te alejaste, arranca en el punto de la ruta más cercano (no se dibuja
 * una recta desde donde estés hasta el camino).
 */
export function rutaRestante(
  ruta: RutaPreparada,
  avance: AvanceRuta,
  pos: LatLng
): [number, number][] {
  const inicio: [number, number] =
    avance.distanciaARutaM <= PEGADO_A_RUTA_M
      ? [pos.lat, pos.lng]
      : [avance.punto.lat, avance.punto.lng]
  return [inicio, ...ruta.coords.slice(avance.segmento + 1)]
}

/** Metros sobre la ruta a los que queda cada punto, respetando el orden en que se visitan. */
export function ubicarEnOrden(ruta: RutaPreparada, puntos: LatLng[]): number[] {
  let previo = 0
  return puntos.map((p) => {
    const avance = avanzarEnRuta(ruta, p, previo)
    // Nunca antes que el punto anterior: en una ida y vuelta el orden manda.
    previo = Math.max(previo, avance?.progresoM ?? previo)
    return previo
  })
}

export function proyectarEnSegmento(
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

/** Parte la ruta planificada en tramo recorrido y tramo restante (sin memoria del avance). */
export function dividirRutaPorAvance(
  ruta: [number, number][],
  pos: LatLng | null
): { recorrido: [number, number][]; restante: [number, number][] } {
  if (!ruta.length) return { recorrido: [], restante: [] }
  if (!pos) return { recorrido: [], restante: ruta }

  const preparada = prepararRuta(ruta)
  const avance = avanzarEnRuta(preparada, pos)
  if (!avance) return { recorrido: [], restante: ruta }

  const recorrido: [number, number][] = [...ruta.slice(0, avance.segmento + 1), [pos.lat, pos.lng]]
  const restante = avance.progresoM >= avance.totalM ? [] : rutaRestante(preparada, avance, pos)
  return { recorrido, restante }
}
