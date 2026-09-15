import type { PrismaClient } from '@prisma/client'
import { distanciaMetros } from '../../lib/geo2d'
import type { GeoJsonLineString } from '../../lib/geo'
import { HttpError } from '../../lib/httpError'
import { computeTrazaFantasma, type PuntoFantasma } from '../../lib/postgis'
import type { FantasmaQuery } from '../viajes/viajes.schemas'

/** Cantidad máxima de puntos que viajan al cliente para animar el fantasma. */
const MAX_PUNTOS = 1500

export type CandidatoFantasma = {
  tipo: 'viaje' | 'plantilla'
  /** `viaje:<viajeId>:<usuarioId>` o `plantilla:<id>`, para elegirlo desde la UI. */
  ref: string
  viaje_id: string | null
  usuario_id: string | null
  plantilla_id: string | null
  nombre: string
  /** Quién dejó la traza (vos u otro integrante) o quién compartió la ruta. */
  autor: string
  es_propio: boolean
  tipo_actividad: string
  fecha: string | null
  distancia_m: number | null
  duracion_seg: number | null
}

export type Fantasma = {
  tipo: 'viaje' | 'plantilla'
  ref: string
  nombre: string
  autor: string
  tipo_actividad: string
  distancia_m: number
  duracion_seg: number
  /** Ritmo constante en plantillas (no hay traza real); traza GPS en viajes. */
  interpolado: boolean
  puntos: PuntoFantasma[]
}

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Integrante'
}

/**
 * RN-073 (SCRUM-49/50): recorrido histórico para superponer como fantasma en el
 * mapa en vivo. Fuentes: la traza GPS de un viaje finalizado (propia o de otro
 * integrante de un viaje compartido) o una ruta compartida importada como
 * plantilla, recorrida a ritmo constante según su tiempo estimado.
 */
export class FantasmaService {
  constructor(private readonly prisma: PrismaClient) {}

  /** RN-070 / RN-072: sin fantasma en moto ni en modo recreativo. */
  private async assertViajeAdmiteFantasma(viajeId: string, usuarioId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        creador_id: true,
        tipo_actividad: true,
        modo: true,
        integrantes: { where: { usuario_id: usuarioId }, select: { estado: true } },
      },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')
    const participa =
      viaje.creador_id === usuarioId || viaje.integrantes.some((i) => i.estado !== 'rechazado')
    if (!participa) throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    if (viaje.tipo_actividad === 'moto') {
      throw new HttpError(409, 'La modalidad moto no admite fantasma (RN-070)', 'FANTASMA_NO_DISPONIBLE')
    }
    if (viaje.modo === 'recreativo') {
      throw new HttpError(
        409,
        'El modo recreativo no muestra comparaciones (RN-072)',
        'FANTASMA_NO_DISPONIBLE'
      )
    }
    return viaje
  }

  /** SCRUM-50: viajes anteriores (propios o compartidos) y plantillas elegibles. */
  async listarCandidatos(usuarioId: string, viajeId: string): Promise<CandidatoFantasma[]> {
    const viaje = await this.assertViajeAdmiteFantasma(viajeId, usuarioId)

    const [metricas, plantillas] = await Promise.all([
      // Trazas de viajes finalizados en los que participé: la mía y las de los demás.
      this.prisma.metricaViaje.findMany({
        where: {
          viaje_id: { not: viajeId },
          viaje: {
            estado: 'finalizado',
            tipo_actividad: { not: 'moto' },
            OR: [
              { creador_id: usuarioId },
              { integrantes: { some: { usuario_id: usuarioId, estado: { in: ['confirmado', 'salido'] } } } },
            ],
          },
          distancia_m: { gt: 0 },
        },
        select: {
          viaje_id: true,
          usuario_id: true,
          distancia_m: true,
          tiempo_movimiento_seg: true,
          usuario: { select: { nombre: true, apellido: true } },
          viaje: { select: { nombre: true, tipo_actividad: true, fecha_fin_real: true } },
        },
        orderBy: { viaje: { fecha_fin_real: 'desc' } },
        take: 60,
      }),
      this.prisma.rutaPlantilla.findMany({
        where: { usuario_id: usuarioId, tipo_actividad: { not: 'moto' }, tiempo_estimado_seg: { gt: 0 } },
        select: {
          id: true,
          nombre: true,
          tipo_actividad: true,
          distancia_planeada_m: true,
          tiempo_estimado_seg: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
    ])

    const deViajes: CandidatoFantasma[] = metricas.map((m) => ({
      tipo: 'viaje',
      ref: `viaje:${m.viaje_id}:${m.usuario_id}`,
      viaje_id: m.viaje_id,
      usuario_id: m.usuario_id,
      plantilla_id: null,
      nombre: m.viaje.nombre?.trim() || 'Viaje',
      autor: m.usuario_id === usuarioId ? 'Vos' : nombreDe(m.usuario),
      es_propio: m.usuario_id === usuarioId,
      tipo_actividad: m.viaje.tipo_actividad,
      fecha: m.viaje.fecha_fin_real?.toISOString() ?? null,
      distancia_m: m.distancia_m,
      duracion_seg: m.tiempo_movimiento_seg,
    }))
    const dePlantillas: CandidatoFantasma[] = plantillas.map((p) => ({
      tipo: 'plantilla',
      ref: `plantilla:${p.id}`,
      viaje_id: null,
      usuario_id: null,
      plantilla_id: p.id,
      nombre: p.nombre,
      autor: 'Ruta compartida',
      es_propio: false,
      tipo_actividad: p.tipo_actividad,
      fecha: p.created_at.toISOString(),
      distancia_m: p.distancia_planeada_m,
      duracion_seg: p.tiempo_estimado_seg,
    }))

    // Primero lo de la misma actividad, y dentro de eso lo propio.
    const peso = (c: CandidatoFantasma) =>
      (c.tipo_actividad === viaje.tipo_actividad ? 0 : 2) + (c.es_propio ? 0 : 1)
    return [...deViajes, ...dePlantillas].sort((a, b) => peso(a) - peso(b))
  }

  /** SCRUM-49: la traza a animar. */
  async obtener(usuarioId: string, viajeId: string, q: FantasmaQuery): Promise<Fantasma> {
    await this.assertViajeAdmiteFantasma(viajeId, usuarioId)

    if (q.plantillaId) return this.desdePlantilla(usuarioId, q.plantillaId)
    return this.desdeViaje(usuarioId, q.viajeRef!, q.usuarioRef ?? usuarioId)
  }

  private async desdeViaje(usuarioId: string, viajeRef: string, usuarioRef: string): Promise<Fantasma> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeRef },
      select: {
        nombre: true,
        estado: true,
        tipo_actividad: true,
        creador_id: true,
        integrantes: { where: { usuario_id: usuarioId }, select: { estado: true } },
      },
    })
    if (!viaje) throw new HttpError(404, 'Viaje de referencia no encontrado', 'VIAJE_NOT_FOUND')
    // Solo trazas de viajes en los que participé: no se espía a nadie por id.
    const participe =
      viaje.creador_id === usuarioId || viaje.integrantes.some((i) => i.estado !== 'rechazado')
    if (!participe) throw new HttpError(403, 'Sin acceso a ese viaje', 'FORBIDDEN')
    if (viaje.estado !== 'finalizado') {
      throw new HttpError(409, 'El viaje de referencia todavía no finalizó', 'TRIP_NOT_FINISHED')
    }
    if (viaje.tipo_actividad === 'moto') {
      throw new HttpError(409, 'La modalidad moto no admite fantasma (RN-070)', 'FANTASMA_NO_DISPONIBLE')
    }

    const [puntos, autor] = await Promise.all([
      computeTrazaFantasma(this.prisma, viajeRef, usuarioRef, MAX_PUNTOS),
      this.prisma.usuario.findUnique({
        where: { id: usuarioRef },
        select: { nombre: true, apellido: true },
      }),
    ])
    const ultimo = puntos[puntos.length - 1]
    if (!ultimo || puntos.length < 2) {
      throw new HttpError(404, 'Ese viaje no tiene traza GPS para usar de fantasma', 'FANTASMA_SIN_TRAZA')
    }
    return {
      tipo: 'viaje',
      ref: `viaje:${viajeRef}:${usuarioRef}`,
      nombre: viaje.nombre?.trim() || 'Viaje',
      autor: usuarioRef === usuarioId ? 'Vos' : autor ? nombreDe(autor) : 'Integrante',
      tipo_actividad: viaje.tipo_actividad,
      distancia_m: ultimo.d_m,
      duracion_seg: ultimo.t_seg,
      interpolado: false,
      puntos,
    }
  }

  /** Ruta compartida: no hay traza real, se recorre a ritmo constante (tiempo estimado). */
  private async desdePlantilla(usuarioId: string, plantillaId: string): Promise<Fantasma> {
    const plantilla = await this.prisma.rutaPlantilla.findUnique({
      where: { id: plantillaId },
      select: {
        usuario_id: true,
        nombre: true,
        tipo_actividad: true,
        linestring_geojson: true,
        tiempo_estimado_seg: true,
      },
    })
    if (!plantilla || plantilla.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Plantilla no encontrada', 'PLANTILLA_NOT_FOUND')
    }
    if (plantilla.tipo_actividad === 'moto') {
      throw new HttpError(409, 'La modalidad moto no admite fantasma (RN-070)', 'FANTASMA_NO_DISPONIBLE')
    }
    const coords = ((plantilla.linestring_geojson as unknown as GeoJsonLineString)?.coordinates ??
      []) as [number, number][]
    if (coords.length < 2 || !plantilla.tiempo_estimado_seg) {
      throw new HttpError(404, 'La ruta no tiene trazado o tiempo estimado', 'FANTASMA_SIN_TRAZA')
    }

    const puntos = interpolarRitmoConstante(coords, plantilla.tiempo_estimado_seg, MAX_PUNTOS)
    const ultimo = puntos[puntos.length - 1]!
    return {
      tipo: 'plantilla',
      ref: `plantilla:${plantillaId}`,
      nombre: plantilla.nombre,
      autor: 'Ruta compartida',
      tipo_actividad: plantilla.tipo_actividad,
      distancia_m: ultimo.d_m,
      duracion_seg: ultimo.t_seg,
      interpolado: true,
      puntos,
    }
  }
}

/**
 * Distribuye el tiempo estimado a lo largo del trazado en proporción a la
 * distancia acumulada de cada vértice (ritmo constante). Es una interpolación
 * para animar, no un cálculo de negocio: por eso no pasa por PostGIS.
 */
export function interpolarRitmoConstante(
  coords: [number, number][],
  duracionSeg: number,
  maxPuntos: number
): PuntoFantasma[] {
  const acum: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]!
    const [lng2, lat2] = coords[i]!
    acum.push(acum[i - 1]! + distanciaMetros(lat1, lng1, lat2, lng2))
  }
  const total = acum[acum.length - 1]!
  const paso = Math.max(1, Math.ceil(coords.length / maxPuntos))
  const puntos: PuntoFantasma[] = []
  for (let i = 0; i < coords.length; i += paso) {
    const [lng, lat] = coords[i]!
    const d = acum[i]!
    puntos.push({ t_seg: total > 0 ? (d / total) * duracionSeg : 0, lat, lng, d_m: d })
  }
  const ultimoIdx = coords.length - 1
  if ((ultimoIdx % paso) !== 0) {
    const [lng, lat] = coords[ultimoIdx]!
    puntos.push({ t_seg: duracionSeg, lat, lng, d_m: total })
  }
  return puntos
}
