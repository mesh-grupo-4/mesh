import { distanciaMetros } from './geo2d'

export type MiembroEnRuta = {
  usuarioId: string
  lat: number
  lng: number
  /** Metros recorridos sobre la ruta planificada desde el origen. */
  progresoM: number
}

export type BloquePrincipal = {
  miembros: MiembroEnRuta[]
  progresoReferenciaM: number
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const sorted = [...valores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * RN-035: identifica el subconjunto mayoritario de integrantes que viajan juntos
 * y devuelve el progreso de referencia (mediana sobre la ruta) del bloque.
 */
export function identificarBloquePrincipal(
  miembros: MiembroEnRuta[],
  distanciaMaxSeparacionM: number
): BloquePrincipal | null {
  if (miembros.length < 2) return null

  let mejorCluster: MiembroEnRuta[] = []

  for (const centro of miembros) {
    const cluster = miembros.filter(
      (m) => distanciaMetros(centro.lat, centro.lng, m.lat, m.lng) <= distanciaMaxSeparacionM
    )
    const progresoCluster = mediana(cluster.map((m) => m.progresoM))
    const progresoMejor = mediana(mejorCluster.map((m) => m.progresoM))

    if (
      cluster.length > mejorCluster.length ||
      (cluster.length === mejorCluster.length && progresoCluster > progresoMejor)
    ) {
      mejorCluster = cluster
    }
  }

  if (mejorCluster.length === 0) return null

  return {
    miembros: mejorCluster,
    progresoReferenciaM: mediana(mejorCluster.map((m) => m.progresoM)),
  }
}

/** Metros de atraso sobre la ruta respecto al bloque principal (0 si va adelante). */
export function atrasoMetros(progresoReferenciaM: number, progresoMiembroM: number): number {
  return Math.max(0, progresoReferenciaM - progresoMiembroM)
}

/** Convierte minutos de tolerancia + velocidad esperada (km/h) a metros de separación. */
export function toleranciaAtrasoMetros(
  velocidadEsperadaKmh: number,
  toleranciaMinutos: number
): number {
  return (velocidadEsperadaKmh * 1000 * toleranciaMinutos) / 60
}
