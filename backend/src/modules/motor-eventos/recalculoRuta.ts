import type { Prisma, PrismaClient } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import type { GeoJsonLineString } from '../../lib/geo'
import { computeFraccionesEnRuta, unirTramoRecorridoConNuevo } from '../../lib/postgis'
import { perfilRutaDesdeActividad } from '../routing/routing.schemas'
import type { RoutingService } from '../routing/routing.service'

export type RutaRecalculada = {
  linestring: GeoJsonLineString
  distancia_planeada_m: number
  tiempo_estimado_seg: number | null
  /** Paradas intermedias que quedaron por delante y se incluyeron en el tramo nuevo. */
  paradas_pendientes: number
}

/**
 * RN-034b: recalcula la ruta de un viaje en curso desde la posición del líder.
 *
 * - El tramo que el grupo ya recorrió se conserva (desde el origen hasta donde el
 *   líder dejó el trazado), para que quien viene atrás no quede "desviado".
 * - El tramo nuevo va de la posición del líder al destino pasando por las paradas
 *   intermedias que todavía estaban por delante; las que quedaron atrás no se tocan.
 * - Origen, destino y paradas intermedias no cambian: solo el trazado, la distancia
 *   planeada y el tiempo estimado.
 */
export async function recalcularRutaDesde(
  prisma: PrismaClient,
  routing: RoutingService,
  viajeId: string,
  desde: { lat: number; lng: number }
): Promise<RutaRecalculada> {
  const ruta = await prisma.ruta.findUnique({
    where: { viaje_id: viajeId },
    select: {
      id: true,
      destino_lat: true,
      destino_lng: true,
      linestring_geojson: true,
      tiempo_estimado_seg: true,
      viaje: { select: { tipo_actividad: true } },
      paradas_intermedias: { orderBy: { orden: 'asc' }, select: { lat: true, lng: true } },
    },
  })
  if (!ruta) {
    throw new HttpError(409, 'El viaje no tiene una ruta planificada', 'SIN_RUTA')
  }
  const vieja = ruta.linestring_geojson as unknown as GeoJsonLineString

  const [fraccionCorte = 0, ...fraccionesParadas] = await computeFraccionesEnRuta(prisma, vieja, [
    desde,
    ...ruta.paradas_intermedias,
  ])
  const pendientes = ruta.paradas_intermedias.filter((_, i) => (fraccionesParadas[i] ?? 0) > fraccionCorte)

  const tramo = await routing.calcularRuta({
    perfil: perfilRutaDesdeActividad(ruta.viaje.tipo_actividad),
    puntos: [
      desde,
      ...pendientes.map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat: ruta.destino_lat, lng: ruta.destino_lng },
    ],
  })

  const { linestring, longitudM } = await unirTramoRecorridoConNuevo(
    prisma,
    vieja,
    fraccionCorte,
    tramo.linestring
  )
  // El tramo ya recorrido conserva su parte proporcional del tiempo estimado original.
  const tiempoEstimadoSeg =
    ruta.tiempo_estimado_seg != null
      ? Math.round(ruta.tiempo_estimado_seg * fraccionCorte + tramo.duracion_seg)
      : Math.round(tramo.duracion_seg)

  await prisma.ruta.update({
    where: { id: ruta.id },
    data: {
      linestring_geojson: linestring as unknown as Prisma.InputJsonValue,
      distancia_planeada_m: longitudM,
      tiempo_estimado_seg: tiempoEstimadoSeg,
    },
  })

  return {
    linestring,
    distancia_planeada_m: longitudM,
    tiempo_estimado_seg: tiempoEstimadoSeg,
    paradas_pendientes: pendientes.length,
  }
}
