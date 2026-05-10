/** Contrato alineado al backend (`putRutaSchema`). */
export type GeoJsonPoint = {
  type: 'Point'
  coordinates: [number, number]
}

export type GeoJsonLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type CategoriaParada = 'combustible' | 'descanso' | 'gastronomia' | 'sanitario' | 'otro'

export type PutRutaBody = {
  origen: GeoJsonPoint
  destino: GeoJsonPoint
  linestring: GeoJsonLineString
  tiempoEstimadoSeg?: number | null
  paradas: Array<{
    orden: number
    lat: number
    lng: number
    categoria: CategoriaParada
  }>
}
