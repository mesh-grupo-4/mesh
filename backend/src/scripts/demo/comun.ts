/**
 * Piezas compartidas por el seed de demo: fechas relativas en hora argentina, acceso a
 * las rutas del catálogo y armado de las filas de `ruta` y `parada_intermedia`.
 */
import { randomUUID } from 'node:crypto'
import polyline from '@mapbox/polyline'
import type { Prisma, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString } from '../../lib/geo'
import { inicioDiaArg } from '../../modules/reportes/reportes.periodo'
import type { UsuarioDemo } from './guion'
import { RUTAS, type RutaCatalogo } from './rutas.catalogo'
import geometrias from './rutas.geometria.json'
import { Camino, type Punto } from './trazas'

export const MS_MIN = 60_000
export const MS_HORA = 3_600_000
export const MS_DIA = 86_400_000

export type Contexto = {
  ahora: Date
  /** Fecha de hoy en Argentina, `YYYY-MM-DD`. */
  hoy: string
  /** Id del usuario con esa clave del guion. */
  usuario: (clave: string) => string
  ficha: (clave: string) => UsuarioDemo
  grupo: (clave: string) => string
}

/** Instante de las `hora` (ART) de hace `haceDias` días; negativo = futuro. */
export function momento(hoy: string, haceDias: number, hora: number): Date {
  return new Date(inicioDiaArg(hoy).getTime() - haceDias * MS_DIA + hora * MS_HORA)
}

/** Semilla estable a partir de un texto, para que cada viaje tenga siempre la misma traza. */
export function semillaDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type RutaDemo = {
  def: RutaCatalogo
  puntos: Punto[]
  camino: Camino
  distanciaM: number
  duracionSeg: number
  linestring: GeoJsonLineString
}

const cacheRutas = new Map<string, RutaDemo>()

export function rutaDemo(clave: string): RutaDemo {
  const guardada = cacheRutas.get(clave)
  if (guardada) return guardada

  const def = RUTAS.find((r) => r.clave === clave)
  const geo = (geometrias as Record<string, { polyline: string; distancia_m: number; duracion_seg: number }>)[clave]
  if (!def || !geo) {
    throw new Error(`La ruta "${clave}" no está en el catálogo o le falta la geometría (npm run demo:rutas)`)
  }
  const puntos = polyline.decode(geo.polyline, 6) as Punto[]
  const ruta: RutaDemo = {
    def,
    puntos,
    camino: new Camino(puntos),
    distanciaM: geo.distancia_m,
    duracionSeg: geo.duracion_seg,
    linestring: { type: 'LineString', coordinates: puntos.map(([lat, lng]): [number, number] => [lng, lat]) },
  }
  cacheRutas.set(clave, ruta)
  return ruta
}

/** Filas de `ruta` y sus `parada_intermedia` para un viaje que sigue una ruta del catálogo. */
export function filasRuta(viajeId: string, clave: string, actividad?: TipoActividad) {
  const r = rutaDemo(clave)
  const rutaId = randomUUID()
  // El tiempo estimado sale del ruteo; si la ruta se hace en otra modalidad no aplica.
  const mismaModalidad = !actividad || actividad === r.def.actividad
  const ruta: Prisma.RutaCreateManyInput = {
    id: rutaId,
    viaje_id: viajeId,
    origen_lat: r.def.origen.lat,
    origen_lng: r.def.origen.lng,
    origen_nombre: r.def.origen.nombre,
    destino_lat: r.def.destino.lat,
    destino_lng: r.def.destino.lng,
    destino_nombre: r.def.destino.nombre,
    linestring_geojson: r.linestring as unknown as Prisma.InputJsonValue,
    distancia_planeada_m: r.distanciaM,
    tiempo_estimado_seg: mismaModalidad ? r.duracionSeg : Math.round(r.duracionSeg * 0.95),
  }
  const paradas: Prisma.ParadaIntermediaCreateManyInput[] = r.def.paradas.map((p, i) => {
    const [lat, lng] = r.camino.posicion(p.fraccion * r.camino.largoM)
    return { ruta_id: rutaId, orden: i, lat, lng, nombre: p.nombre, categoria: p.categoria }
  })
  return { ruta, paradas }
}

/**
 * Corre `fn` sobre cada elemento con hasta `limite` a la vez, conservando el orden.
 * La base está lejos (cada consulta tarda ~200 ms): en serie el seed tardaría el triple.
 */
export async function enParalelo<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length)
  let siguiente = 0
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++
      resultados[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador))
  return resultados
}

/** Inserta de a tandas para no armar un INSERT gigante. */
export async function porLotes<T>(filas: T[], insertar: (lote: T[]) => Promise<unknown>, tamano = 1000) {
  for (let i = 0; i < filas.length; i += tamano) {
    await insertar(filas.slice(i, i + tamano))
  }
}
