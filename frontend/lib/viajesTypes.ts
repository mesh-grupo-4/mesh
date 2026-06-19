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
  | 'kiosco'
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
  tiempo_estimado_seg: number | null
  distancia_planeada_m: number | null
  paradas: Array<{
    orden: number
    lat: number
    lng: number
    nombre: string | null
    categoria: CategoriaParada
  }>
}
