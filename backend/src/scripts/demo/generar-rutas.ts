/**
 * Calcula la geometría de las rutas del catálogo y la congela en `rutas.geometria.json`.
 *
 *   npm run demo:rutas
 *
 * Solo hace falta correrlo si se agrega o cambia una ruta en `rutas.catalogo.ts`: el
 * archivo generado se commitea y el seed lo lee sin salir a internet.
 *
 * Usa el Valhalla público de OpenStreetMap (el mismo respaldo que `routing.service.ts`)
 * porque es el único de los tres proveedores que rutea senderos de trekking.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import polyline from '@mapbox/polyline'
import { RUTAS, type RutaCatalogo } from './rutas.catalogo'

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'
/** Precisión de la polyline guardada (6 decimales ≈ 11 cm). */
export const PRECISION_POLYLINE = 6

type Punto = [lat: number, lng: number]

export type GeometriaRuta = {
  /** Polyline codificada con `PRECISION_POLYLINE`. */
  polyline: string
  distancia_m: number
  duracion_seg: number
}

type ValhallaResponse = {
  trip?: { status: number; summary: { time: number; length: number }; legs: { shape: string }[] }
  error?: string
}

/** Distancia en metros de `p` al segmento `a`-`b`, en proyección local (alcanza para simplificar). */
function distanciaASegmentoM(p: Punto, a: Punto, b: Punto): number {
  const kLat = 111_320
  const kLng = 111_320 * Math.cos((a[0] * Math.PI) / 180)
  const [px, py] = [(p[1] - a[1]) * kLng, (p[0] - a[0]) * kLat]
  const [bx, by] = [(b[1] - a[1]) * kLng, (b[0] - a[0]) * kLat]
  const largo2 = bx * bx + by * by
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / largo2))
  return Math.hypot(px - t * bx, py - t * by)
}

/** Douglas-Peucker iterativo: saca los puntos que no cambian el dibujo de la ruta. */
function simplificar(puntos: Punto[], toleranciaM: number): Punto[] {
  if (puntos.length < 3) return puntos
  const conservar = new Uint8Array(puntos.length)
  conservar[0] = 1
  conservar[puntos.length - 1] = 1
  const pila: [number, number][] = [[0, puntos.length - 1]]
  while (pila.length > 0) {
    const [desde, hasta] = pila.pop()!
    let maximo = 0
    let indice = -1
    for (let i = desde + 1; i < hasta; i++) {
      const d = distanciaASegmentoM(puntos[i]!, puntos[desde]!, puntos[hasta]!)
      if (d > maximo) {
        maximo = d
        indice = i
      }
    }
    if (indice !== -1 && maximo > toleranciaM) {
      conservar[indice] = 1
      pila.push([desde, indice], [indice, hasta])
    }
  }
  return puntos.filter((_, i) => conservar[i] === 1)
}

async function calcular(ruta: RutaCatalogo): Promise<GeometriaRuta> {
  const locations = [
    { lat: ruta.origen.lat, lon: ruta.origen.lng, type: 'break' },
    ...(ruta.via ?? []).map((p) => ({ lat: p.lat, lon: p.lng, type: 'through' })),
    { lat: ruta.destino.lat, lon: ruta.destino.lng, type: 'break' },
  ]
  const res = await fetch(VALHALLA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'mesh-demo-seed' },
    body: JSON.stringify({ locations, costing: ruta.perfil, units: 'kilometers' }),
  })
  const json = (await res.json()) as ValhallaResponse
  if (!res.ok || !json.trip || json.trip.status !== 0) {
    throw new Error(`Valhalla no pudo rutear "${ruta.clave}": ${json.error ?? res.status}`)
  }

  const puntos: Punto[] = []
  json.trip.legs.forEach((leg, i) => {
    const tramo = polyline.decode(leg.shape, 6) as Punto[]
    puntos.push(...(i === 0 ? tramo : tramo.slice(1)))
  })
  // A pie importa cada curva del sendero; en ruta alcanza con menos detalle.
  const simplificada = simplificar(puntos, ruta.perfil === 'pedestrian' ? 2 : 5)
  return {
    polyline: polyline.encode(simplificada, PRECISION_POLYLINE),
    distancia_m: Math.round(json.trip.summary.length * 1000),
    duracion_seg: Math.round(json.trip.summary.time),
  }
}

async function main() {
  const salida: Record<string, GeometriaRuta> = {}
  for (const ruta of RUTAS) {
    const g = await calcular(ruta)
    salida[ruta.clave] = g
    const puntos = polyline.decode(g.polyline, PRECISION_POLYLINE).length
    console.log(
      `${ruta.clave.padEnd(18)} ${(g.distancia_m / 1000).toFixed(1).padStart(6)} km  ` +
        `${Math.round(g.duracion_seg / 60).toString().padStart(4)} min  ${puntos} puntos`
    )
    // El servidor público pide como mucho un pedido por segundo.
    await new Promise((r) => setTimeout(r, 1200))
  }
  const destino = path.join(__dirname, 'rutas.geometria.json')
  writeFileSync(destino, `${JSON.stringify(salida, null, 1)}\n`)
  console.log(`\n${RUTAS.length} rutas guardadas en ${destino}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
