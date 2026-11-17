/** Contrato alineado al backend (`putRutaSchema`). */
export type GeoJsonPoint = {
  type: 'Point'
  coordinates: [number, number]
}

export type GeoJsonLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type CategoriaParada =
  | 'accidente'
  | 'combustible'
  | 'descanso'
  | 'gastronomia'
  | 'punto_control'
  | 'sanitario'
  | 'otro'

export type PutRutaBody = {
  origen: GeoJsonPoint
  destino: GeoJsonPoint
  origenNombre?: string | null
  destinoNombre?: string | null
  linestring: GeoJsonLineString
  tiempoEstimadoSeg?: number | null
  paradas: Array<{
    orden: number
    lat: number
    lng: number
    nombre?: string | null
    categoria: CategoriaParada
  }>
}

export type RutaDetalleApi = {
  origen: { lat: number; lng: number; nombre: string | null }
  destino: { lat: number; lng: number; nombre: string | null }
  linestring: GeoJsonLineString
  /** Tiempo en movimiento, sin paradas. */
  tiempo_estimado_seg: number | null
  /** RN-134: minutos promedio de las paradas planificadas, en segundos. */
  tiempo_paradas_seg?: number
  /** RN-134: movimiento + paradas. */
  tiempo_total_estimado_seg?: number | null
  distancia_planeada_m: number | null
  paradas: Array<{
    orden: number
    lat: number
    lng: number
    nombre: string | null
    categoria: CategoriaParada
  }>
}
