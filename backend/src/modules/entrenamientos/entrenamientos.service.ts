import type { CategoriaParada, Prisma, PrismaClient, TipoActividad } from '@prisma/client'
import { ACTIVIDADES_MOTORIZADAS, esMotorizado } from '../../lib/actividad'
import type { GeoJsonLineString } from '../../lib/geo'
import { HttpError } from '../../lib/httpError'
import { computeLineStringLengthMeters, computeTrazaRecorrido } from '../../lib/postgis'
import type { ListarCircuitosQuery, ListarSesionesQuery } from './entrenamientos.schemas'

/** Cuántas sesiones entran en la evolución de un circuito (igual que RN-065). */
const SESIONES_EVOLUCION = 6
/** Tope de la lista de sesiones: alcanza para años de entrenamientos y acota la respuesta. */
const MAX_SESIONES = 200

export type RecorridoRepeticion = 'planificado' | 'real'

/** Ruta lista para copiar al viaje nuevo, ya resuelta antes de abrir la transacción. */
export type RepeticionPreparada = {
  origen: { id: string; nombre: string | null; tipo_actividad: TipoActividad }
  ruta: {
    origen_lat: number
    origen_lng: number
    origen_nombre: string | null
    destino_lat: number
    destino_lng: number
    destino_nombre: string | null
    linestring_geojson: Prisma.InputJsonValue
    distancia_planeada_m: number | null
    tiempo_estimado_seg: number | null
    paradas: { orden: number; lat: number; lng: number; nombre: string | null; categoria: CategoriaParada }[]
  }
}

function paceMinKm(distanciaM: number, tiempoMovimientoSeg: number): number | null {
  return tiempoMovimientoSeg > 0 && distanciaM > 0 ? tiempoMovimientoSeg / 60 / (distanciaM / 1000) : null
}

/** Sesión = viaje finalizado en modo entrenamiento, no motorizado (RN-065 / RN-070). */
const WHERE_VIAJE_SESION = {
  estado: 'finalizado',
  modo: 'entrenamiento',
  tipo_actividad: { notIn: [...ACTIVIDADES_MOTORIZADAS] },
} as const satisfies Prisma.ViajeWhereInput

/**
 * RN-066: entrenamientos como serie. Lista las sesiones de quien consulta, las
 * agrupa en circuitos (propios de cada persona) y prepara la repetición de una
 * sesión para `ViajesService.crearViaje`.
 *
 * Todo sale de `metrica_viaje`: una sesión es de quien tiene métricas en ese
 * viaje, lo haya creado o no. Nunca se leen posiciones de otra persona.
 */
export class EntrenamientosService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  private readonly selectSesion = (usuarioId: string) =>
    ({
      viaje_id: true,
      distancia_m: true,
      tiempo_movimiento_seg: true,
      velocidad_promedio_kmh: true,
      viaje: {
        select: {
          nombre: true,
          tipo_actividad: true,
          creador_id: true,
          fecha_fin_real: true,
          ruta: { select: { id: true } },
          circuito_sesiones: {
            where: { usuario_id: usuarioId },
            select: { circuito: { select: { id: true, nombre: true } } },
          },
        },
      },
    }) satisfies Prisma.MetricaViajeSelect

  private aSesion(
    usuarioId: string,
    f: Prisma.MetricaViajeGetPayload<{ select: ReturnType<EntrenamientosService['selectSesion']> }>
  ) {
    return {
      viaje_id: f.viaje_id,
      nombre: f.viaje.nombre?.trim() || 'Entrenamiento',
      tipo_actividad: f.viaje.tipo_actividad,
      fecha_fin_real: f.viaje.fecha_fin_real,
      es_creador: f.viaje.creador_id === usuarioId,
      distancia_m: f.distancia_m,
      tiempo_movimiento_seg: f.tiempo_movimiento_seg,
      velocidad_promedio_kmh: f.velocidad_promedio_kmh,
      pace_min_km: paceMinKm(f.distancia_m, f.tiempo_movimiento_seg),
      circuito: f.viaje.circuito_sesiones[0]?.circuito ?? null,
      // Qué recorrido se puede repetir: lo planificado necesita ruta; lo hecho, traza GPS.
      repetir: {
        planificado: f.viaje.ruta != null,
        real: f.distancia_m > 0,
      },
    }
  }

  /** Mis sesiones de entrenamiento, de la más nueva a la más vieja. */
  async listarSesiones(usuarioId: string, q: ListarSesionesQuery) {
    const filas = await this.prisma.metricaViaje.findMany({
      where: {
        usuario_id: usuarioId,
        viaje: {
          ...WHERE_VIAJE_SESION,
          ...(q.tipoActividad ? { tipo_actividad: q.tipoActividad } : {}),
          ...(q.circuitoId
            ? { circuito_sesiones: { some: { usuario_id: usuarioId, circuito_id: q.circuitoId } } }
            : {}),
        },
      },
      select: this.selectSesion(usuarioId),
      orderBy: { viaje: { fecha_fin_real: 'desc' } },
      take: MAX_SESIONES,
    })
    return filas.map((f) => this.aSesion(usuarioId, f))
  }

  /** Una sesión puntual: la usa "Repetir" para saber qué recorridos ofrecer. */
  async obtenerSesion(usuarioId: string, viajeId: string) {
    const fila = await this.prisma.metricaViaje.findFirst({
      where: { usuario_id: usuarioId, viaje_id: viajeId, viaje: WHERE_VIAJE_SESION },
      select: this.selectSesion(usuarioId),
    })
    if (!fila) throw new HttpError(404, 'Sesión de entrenamiento no encontrada', 'SESION_NOT_FOUND')
    return this.aSesion(usuarioId, fila)
  }

  /** Mis circuitos con su evolución. Los que todavía no tienen sesiones terminadas no se listan. */
  async listarCircuitos(usuarioId: string, q: ListarCircuitosQuery) {
    const circuitos = await this.prisma.circuitoEntrenamiento.findMany({
      where: {
        usuario_id: usuarioId,
        tipo_actividad: q.tipoActividad ?? { notIn: [...ACTIVIDADES_MOTORIZADAS] },
      },
      select: {
        id: true,
        nombre: true,
        tipo_actividad: true,
        ruta_plantilla_id: true,
        sesiones: {
          where: { viaje: WHERE_VIAJE_SESION },
          select: {
            viaje: {
              select: {
                id: true,
                nombre: true,
                fecha_fin_real: true,
                metricas: {
                  where: { usuario_id: usuarioId },
                  select: { distancia_m: true, tiempo_movimiento_seg: true },
                },
              },
            },
          },
        },
      },
    })

    return circuitos
      .map((c) => {
        const sesiones = c.sesiones
          .flatMap((s) => {
            const m = s.viaje.metricas[0]
            if (!m) return []
            return [
              {
                viaje_id: s.viaje.id,
                nombre: s.viaje.nombre?.trim() || 'Entrenamiento',
                fecha_fin_real: s.viaje.fecha_fin_real,
                distancia_m: m.distancia_m,
                tiempo_movimiento_seg: m.tiempo_movimiento_seg,
                pace_min_km: paceMinKm(m.distancia_m, m.tiempo_movimiento_seg),
              },
            ]
          })
          .sort((a, b) => (a.fecha_fin_real?.getTime() ?? 0) - (b.fecha_fin_real?.getTime() ?? 0))

        const paces = sesiones.flatMap((s) => (s.pace_min_km != null ? [s.pace_min_km] : []))
        const ultima = sesiones[sesiones.length - 1] ?? null
        return {
          id: c.id,
          nombre: c.nombre,
          tipo_actividad: c.tipo_actividad,
          ruta_plantilla_id: c.ruta_plantilla_id,
          total_sesiones: sesiones.length,
          mejor_pace_min_km: paces.length > 0 ? Math.min(...paces) : null,
          mejor_distancia_m: sesiones.length > 0 ? Math.max(...sesiones.map((s) => s.distancia_m)) : null,
          ultima_sesion_viaje_id: ultima?.viaje_id ?? null,
          ultima_sesion_fecha: ultima?.fecha_fin_real ?? null,
          // De la más vieja a la más nueva, para graficar.
          evolucion: sesiones.slice(-SESIONES_EVOLUCION),
        }
      })
      .filter((c) => c.total_sesiones > 0)
      .sort((a, b) => (b.ultima_sesion_fecha?.getTime() ?? 0) - (a.ultima_sesion_fecha?.getTime() ?? 0))
  }

  // ── Edición de circuitos ──────────────────────────────────────────────────

  private async circuitoPropio(usuarioId: string, circuitoId: string) {
    const circuito = await this.prisma.circuitoEntrenamiento.findUnique({
      where: { id: circuitoId },
      select: { id: true, usuario_id: true },
    })
    // Un circuito ajeno responde igual que uno inexistente: no se confirma que existe.
    if (!circuito || circuito.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Circuito no encontrado', 'CIRCUITO_NOT_FOUND')
    }
    return circuito
  }

  async renombrarCircuito(usuarioId: string, circuitoId: string, nombre: string) {
    await this.circuitoPropio(usuarioId, circuitoId)
    return this.prisma.circuitoEntrenamiento.update({
      where: { id: circuitoId },
      data: { nombre },
      select: { id: true, nombre: true, tipo_actividad: true },
    })
  }

  /** Saca una sesión del circuito (queda suelta). Un circuito sin sesiones se elimina. */
  async sacarSesion(usuarioId: string, circuitoId: string, viajeId: string) {
    await this.circuitoPropio(usuarioId, circuitoId)
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.circuitoSesion.deleteMany({
        where: { usuario_id: usuarioId, viaje_id: viajeId, circuito_id: circuitoId },
      })
      if (count === 0) {
        throw new HttpError(404, 'Esa sesión no está en el circuito', 'SESION_NOT_FOUND')
      }
      const quedan = await tx.circuitoSesion.count({ where: { circuito_id: circuitoId } })
      if (quedan === 0) await tx.circuitoEntrenamiento.delete({ where: { id: circuitoId } })
    })
  }

  // ── Repetición (la usa ViajesService.crearViaje) ──────────────────────────

  /**
   * Valida que la sesión se pueda repetir y arma la ruta del viaje nuevo.
   * Corre antes de la transacción de alta: la traza real se calcula con PostGIS.
   */
  async prepararRepeticion(
    usuarioId: string,
    repetir: { viajeId: string; recorrido: RecorridoRepeticion }
  ): Promise<RepeticionPreparada> {
    const metrica = await this.prisma.metricaViaje.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: repetir.viajeId, usuario_id: usuarioId } },
      select: {
        tiempo_movimiento_seg: true,
        viaje: {
          select: {
            id: true,
            nombre: true,
            estado: true,
            modo: true,
            tipo_actividad: true,
            ruta: { include: { paradas_intermedias: { orderBy: { orden: 'asc' } } } },
          },
        },
      },
    })
    // Sin métricas propias en ese viaje no es una sesión mía: no se repite lo ajeno por id.
    if (!metrica) throw new HttpError(404, 'Sesión de entrenamiento no encontrada', 'SESION_NOT_FOUND')

    const viaje = metrica.viaje
    if (viaje.estado !== 'finalizado' || viaje.modo !== 'entrenamiento' || esMotorizado(viaje.tipo_actividad)) {
      throw new HttpError(
        409,
        'Solo se repiten sesiones de entrenamiento finalizadas',
        'SESION_NO_REPETIBLE'
      )
    }
    const origen = { id: viaje.id, nombre: viaje.nombre, tipo_actividad: viaje.tipo_actividad }

    if (repetir.recorrido === 'planificado') {
      const r = viaje.ruta
      if (!r) {
        throw new HttpError(409, 'Esa sesión no tenía un recorrido planificado', 'SIN_RECORRIDO')
      }
      return {
        origen,
        ruta: {
          origen_lat: r.origen_lat,
          origen_lng: r.origen_lng,
          origen_nombre: r.origen_nombre,
          destino_lat: r.destino_lat,
          destino_lng: r.destino_lng,
          destino_nombre: r.destino_nombre,
          linestring_geojson: r.linestring_geojson as Prisma.InputJsonValue,
          distancia_planeada_m: r.distancia_planeada_m,
          tiempo_estimado_seg: r.tiempo_estimado_seg,
          paradas: r.paradas_intermedias.map((p) => ({
            orden: p.orden,
            lat: p.lat,
            lng: p.lng,
            nombre: p.nombre,
            categoria: p.categoria,
          })),
        },
      }
    }

    // "Lo que hice": mi traza GPS de esa sesión, ya simplificada por PostGIS.
    const tramos = await computeTrazaRecorrido(this.prisma, viaje.id, usuarioId)
    const puntos = tramos.flat()
    const primero = puntos[0]
    const ultimo = puntos[puntos.length - 1]
    if (!primero || !ultimo || puntos.length < 2) {
      throw new HttpError(409, 'Esa sesión no tiene traza GPS para repetir', 'SIN_RECORRIDO')
    }
    const linestring: GeoJsonLineString = {
      type: 'LineString',
      coordinates: puntos.map(([lat, lng]) => [lng, lat]),
    }
    const distanciaM = await computeLineStringLengthMeters(this.prisma, linestring)
    return {
      origen,
      ruta: {
        origen_lat: primero[0],
        origen_lng: primero[1],
        origen_nombre: null,
        destino_lat: ultimo[0],
        destino_lng: ultimo[1],
        destino_nombre: null,
        linestring_geojson: linestring as unknown as Prisma.InputJsonValue,
        distancia_planeada_m: distanciaM,
        tiempo_estimado_seg: metrica.tiempo_movimiento_seg > 0 ? metrica.tiempo_movimiento_seg : null,
        paradas: [],
      },
    }
  }

  /** Copia la ruta preparada al viaje nuevo y lo suma al circuito de la sesión original. */
  async aplicarRepeticion(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    viajeId: string,
    prep: RepeticionPreparada
  ) {
    const { paradas, ...datosRuta } = prep.ruta
    const ruta = await tx.ruta.create({ data: { viaje_id: viajeId, ...datosRuta } })
    if (paradas.length > 0) {
      await tx.paradaIntermedia.createMany({
        data: paradas.map((p) => ({ ruta_id: ruta.id, ...p })),
      })
    }

    const yaEnCircuito = await tx.circuitoSesion.findUnique({
      where: { usuario_id_viaje_id: { usuario_id: usuarioId, viaje_id: prep.origen.id } },
      select: { circuito_id: true },
    })
    let circuitoId = yaEnCircuito?.circuito_id
    if (!circuitoId) {
      // Primera repetición: nace el circuito con el nombre de la sesión original.
      const circuito = await tx.circuitoEntrenamiento.create({
        data: {
          usuario_id: usuarioId,
          nombre: (prep.origen.nombre?.trim() || 'Entrenamiento').slice(0, 100),
          tipo_actividad: prep.origen.tipo_actividad,
          sesiones: { create: { usuario_id: usuarioId, viaje_id: prep.origen.id } },
        },
        select: { id: true },
      })
      circuitoId = circuito.id
    }
    await tx.circuitoSesion.create({
      data: { usuario_id: usuarioId, viaje_id: viajeId, circuito_id: circuitoId },
    })
  }

  /** Un entrenamiento que sale de una ruta guardada se agrupa con los demás de esa ruta. */
  async sumarAlCircuitoDePlantilla(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    viajeId: string,
    plantillaId: string
  ) {
    const plantilla = await tx.rutaPlantilla.findUnique({
      where: { id: plantillaId },
      select: { nombre: true, tipo_actividad: true },
    })
    if (!plantilla) return
    const circuito = await tx.circuitoEntrenamiento.upsert({
      where: { usuario_id_ruta_plantilla_id: { usuario_id: usuarioId, ruta_plantilla_id: plantillaId } },
      create: {
        usuario_id: usuarioId,
        nombre: plantilla.nombre.slice(0, 100),
        tipo_actividad: plantilla.tipo_actividad,
        ruta_plantilla_id: plantillaId,
      },
      update: {},
      select: { id: true },
    })
    await tx.circuitoSesion.create({
      data: { usuario_id: usuarioId, viaje_id: viajeId, circuito_id: circuito.id },
    })
  }
}
