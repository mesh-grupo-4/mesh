import { Prisma } from '@prisma/client'
import type { PrismaClient, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString } from '../../lib/geo'
import { HttpError } from '../../lib/httpError'
import { computeLineStringLengthMeters, computeTrazaRecorrido } from '../../lib/postgis'
import { mapPlantilla } from '../rutas-compartidas/rutas-compartidas.service'

type Segmentos = [number, number][][]

/** SCRUM-62: centro y radio de la zona geográfica a explorar. */
export type ZonaBusqueda = { lat: number; lng: number; radioKm: number }

/** Nombre por defecto de una plantilla importada si el recorrido no tenía nombre. */
const NOMBRE_PLANTILLA_DEFAULT = 'Recorrido de la comunidad'

/**
 * RN-082 / SCRUM-63: resumen de la valoración de la comunidad. `porcentaje_recomienda` es
 * entero (0–100) o `null` si nadie valoró todavía. `mi_valoracion` es la de quien consulta.
 */
export type ResumenValoracion = {
  recomiendan: number
  no_recomiendan: number
  total: number
  porcentaje_recomienda: number | null
  mi_valoracion: boolean | null
}

function resumenValoracion(
  recomiendan: number,
  noRecomiendan: number,
  mia: boolean | null
): ResumenValoracion {
  const total = recomiendan + noRecomiendan
  return {
    recomiendan,
    no_recomiendan: noRecomiendan,
    total,
    porcentaje_recomienda: total === 0 ? null : Math.round((recomiendan / total) * 100),
    mi_valoracion: mia,
  }
}

function esUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'P2002')
}

type FilaResumen = {
  id: string
  viaje_id: string
  nombre: string | null
  tipo_actividad: TipoActividad
  distancia_m: number
  tiempo_seg: number
  publicado_at: Date
  usuario: { id: string; nombre: string; apellido: string | null }
}

/**
 * Solo distancia y tiempo: nunca velocidad (RN-070). Un recorrido en moto se puede
 * publicar y ver como referencia, pero no se compara ni se ordena por rendimiento.
 */
function aResumen(r: FilaResumen) {
  return {
    id: r.id,
    viaje_id: r.viaje_id,
    nombre: r.nombre,
    tipo_actividad: r.tipo_actividad,
    distancia_m: r.distancia_m,
    tiempo_seg: r.tiempo_seg,
    publicado_at: r.publicado_at.toISOString(),
    autor: { id: r.usuario.id, nombre: r.usuario.nombre, apellido: r.usuario.apellido },
  }
}

const SELECT_RESUMEN = {
  id: true,
  viaje_id: true,
  nombre: true,
  tipo_actividad: true,
  distancia_m: true,
  tiempo_seg: true,
  publicado_at: true,
  usuario: { select: { id: true, nombre: true, apellido: true } },
} as const

export class RecorridosPublicadosService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-081: publica un viaje del historial propio (finalizado y en el que el usuario
   * participó, incluido quien salió a mitad). Congela un snapshot de SU traza y SUS
   * métricas. Idempotente: republicar refresca el snapshot y reactiva el recorrido.
   */
  async publicar(usuarioId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        creador_id: true,
        nombre: true,
        tipo_actividad: true,
        estado: true,
        integrantes: {
          where: { usuario_id: usuarioId },
          select: { estado: true },
        },
      },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')

    const participo =
      viaje.creador_id === usuarioId ||
      viaje.integrantes.some((i) => i.estado === 'confirmado' || i.estado === 'salido')
    if (!participo) throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')

    if (viaje.estado !== 'finalizado') {
      throw new HttpError(409, 'Solo se pueden publicar viajes finalizados', 'VIAJE_NO_FINALIZADO')
    }

    const [metrica, segmentos] = await Promise.all([
      this.prisma.metricaViaje.findUnique({
        where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
        select: { distancia_m: true, tiempo_movimiento_seg: true },
      }),
      computeTrazaRecorrido(this.prisma, viajeId, usuarioId),
    ])
    if (!metrica || segmentos.flat().length < 2) {
      throw new HttpError(
        422,
        'El viaje no tiene un recorrido GPS para publicar',
        'RECORRIDO_SIN_TRAZA'
      )
    }

    const inicio = segmentos.flat()[0]!
    const datos = {
      nombre: viaje.nombre,
      tipo_actividad: viaje.tipo_actividad,
      distancia_m: metrica.distancia_m,
      tiempo_seg: metrica.tiempo_movimiento_seg,
      segmentos,
      inicio_lat: inicio[0],
      inicio_lng: inicio[1],
    }
    const publicado = await this.prisma.recorridoPublicado.upsert({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      create: { viaje_id: viajeId, usuario_id: usuarioId, ...datos },
      update: { ...datos, activo: true, publicado_at: new Date() },
      select: SELECT_RESUMEN,
    })
    return aResumen(publicado)
  }

  /** RN-081: despublicar en cualquier momento. Solo el autor puede (filtra por usuario_id). */
  async despublicar(usuarioId: string, viajeId: string): Promise<void> {
    const { count } = await this.prisma.recorridoPublicado.updateMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId, activo: true },
      data: { activo: false },
    })
    if (count === 0) {
      throw new HttpError(404, 'Recorrido no publicado', 'RECORRIDO_NOT_FOUND')
    }
  }

  /** Viajes propios hoy publicados: la app los usa para mostrar "Publicado" vs "Publicar". */
  async idsViajesPublicados(usuarioId: string): Promise<{ viaje_ids: string[] }> {
    const filas = await this.prisma.recorridoPublicado.findMany({
      where: { usuario_id: usuarioId, activo: true },
      select: { viaje_id: true },
    })
    return { viaje_ids: filas.map((f) => f.viaje_id) }
  }

  /**
   * Visibles para todos los usuarios autenticados (RN-081). Más reciente primero.
   * SCRUM-62: filtrables por actividad y por zona (recorridos que arrancan dentro del radio).
   */
  async listar(
    usuarioId: string,
    filtros: {
      tipoActividad?: TipoActividad
      zona?: ZonaBusqueda
      limit: number
      offset: number
    }
  ) {
    const resumenes = await this.listarResumenes(filtros)
    const valoraciones = await this.valoraciones(
      usuarioId,
      resumenes.map((r) => r.id)
    )
    return resumenes.map((r) => ({ ...r, valoracion: valoraciones.get(r.id)! }))
  }

  private async listarResumenes(filtros: {
    tipoActividad?: TipoActividad
    zona?: ZonaBusqueda
    limit: number
    offset: number
  }) {
    if (filtros.zona) {
      const ids = await this.idsEnZona(filtros.zona, filtros)
      if (ids.length === 0) return []
      const filas = await this.prisma.recorridoPublicado.findMany({
        where: { id: { in: ids } },
        select: SELECT_RESUMEN,
      })
      // `in` no respeta el orden: se restituye el de la consulta espacial.
      const porId = new Map(filas.map((f) => [f.id, f]))
      return ids.flatMap((id) => {
        const fila = porId.get(id)
        return fila ? [aResumen(fila)] : []
      })
    }

    const where = {
      activo: true,
      ...(filtros.tipoActividad ? { tipo_actividad: filtros.tipoActividad } : {}),
    }
    const filas = await this.prisma.recorridoPublicado.findMany({
      where,
      select: SELECT_RESUMEN,
      orderBy: { publicado_at: 'desc' },
      take: filtros.limit,
      skip: filtros.offset,
    })
    return filas.map(aResumen)
  }

  /** El cálculo espacial lo hace PostGIS (ST_DWithin sobre geography, en metros). */
  private async idsEnZona(
    zona: ZonaBusqueda,
    filtros: { tipoActividad?: TipoActividad; limit: number; offset: number }
  ): Promise<string[]> {
    const filtroActividad = filtros.tipoActividad
      ? Prisma.sql`AND tipo_actividad = ${filtros.tipoActividad}::"TipoActividad"`
      : Prisma.empty
    const filas = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id::text AS id
        FROM recorrido_publicado
        WHERE activo
          AND inicio_lat IS NOT NULL
          AND inicio_lng IS NOT NULL
          ${filtroActividad}
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(inicio_lng, inicio_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${zona.lng}::float8, ${zona.lat}::float8), 4326)::geography,
            ${zona.radioKm * 1000}::float8
          )
        ORDER BY publicado_at DESC
        LIMIT ${filtros.limit}::int
        OFFSET ${filtros.offset}::int
      `
    )
    return filas.map((f) => f.id)
  }

  /** Detalle con la traza para dibujar el mapa. Un recorrido despublicado es 404 para todos. */
  async obtener(usuarioId: string, recorridoId: string) {
    const r = await this.prisma.recorridoPublicado.findFirst({
      where: { id: recorridoId, activo: true },
      select: { ...SELECT_RESUMEN, segmentos: true },
    })
    if (!r) throw new HttpError(404, 'Recorrido no encontrado', 'RECORRIDO_NOT_FOUND')
    const valoraciones = await this.valoraciones(usuarioId, [r.id])
    return {
      ...aResumen(r),
      valoracion: valoraciones.get(r.id)!,
      segmentos: r.segmentos as Segmentos,
    }
  }

  /**
   * RN-082 / SCRUM-63: "Recomiendo" o "No recomiendo", una sola vez por recorrido. No se
   * cambia ni se borra después. El autor no valora lo propio: la valoración es para
   * ayudar a otros a elegir. Sin texto (RN-083): el contrato no tiene dónde ponerlo.
   */
  async valorar(
    usuarioId: string,
    recorridoId: string,
    recomiendo: boolean
  ): Promise<ResumenValoracion> {
    const recorrido = await this.prisma.recorridoPublicado.findFirst({
      where: { id: recorridoId, activo: true },
      select: { usuario_id: true },
    })
    if (!recorrido) throw new HttpError(404, 'Recorrido no encontrado', 'RECORRIDO_NOT_FOUND')
    if (recorrido.usuario_id === usuarioId) {
      throw new HttpError(403, 'No podés valorar tu propio recorrido', 'VALORACION_PROPIA')
    }

    try {
      await this.prisma.valoracionRecorrido.create({
        data: { recorrido_publicado_id: recorridoId, usuario_id: usuarioId, recomiendo },
      })
    } catch (err) {
      if (esUniqueViolation(err)) {
        throw new HttpError(409, 'Ya valoraste este recorrido', 'VALORACION_EXISTENTE')
      }
      throw err
    }

    const valoraciones = await this.valoraciones(usuarioId, [recorridoId])
    return valoraciones.get(recorridoId)!
  }

  /** Conteos por recorrido (un `groupBy`) + la valoración propia. Siempre una entrada por id. */
  private async valoraciones(
    usuarioId: string,
    recorridoIds: string[]
  ): Promise<Map<string, ResumenValoracion>> {
    const resultado = new Map<string, ResumenValoracion>()
    if (recorridoIds.length === 0) return resultado

    const [conteos, mias] = await Promise.all([
      this.prisma.valoracionRecorrido.groupBy({
        by: ['recorrido_publicado_id', 'recomiendo'],
        where: { recorrido_publicado_id: { in: recorridoIds } },
        _count: { _all: true },
      }),
      this.prisma.valoracionRecorrido.findMany({
        where: { recorrido_publicado_id: { in: recorridoIds }, usuario_id: usuarioId },
        select: { recorrido_publicado_id: true, recomiendo: true },
      }),
    ])

    const miaPorId = new Map(mias.map((m) => [m.recorrido_publicado_id, m.recomiendo]))
    for (const id of recorridoIds) {
      let si = 0
      let no = 0
      for (const c of conteos) {
        if (c.recorrido_publicado_id !== id) continue
        if (c.recomiendo) si += c._count._all
        else no += c._count._all
      }
      resultado.set(id, resumenValoracion(si, no, miaPorId.get(id) ?? null))
    }
    return resultado
  }

  /**
   * RN-084 / SCRUM-62: importa un recorrido publicado como plantilla en "Mis rutas", para
   * usarlo como base de un viaje nuevo (`POST /viajes` con `rutaPlantillaId`).
   *
   * La plantilla es una copia independiente (RN-086): la traza se convierte en el trazado
   * planificado, el primer y el último punto en origen y destino. Sin paradas: un
   * recorrido publicado no las tiene. Idempotente por (usuario, recorrido).
   */
  async importar(usuarioId: string, recorridoId: string) {
    const recorrido = await this.prisma.recorridoPublicado.findFirst({
      where: { id: recorridoId, activo: true },
      select: { id: true, nombre: true, tipo_actividad: true, tiempo_seg: true, segmentos: true },
    })
    if (!recorrido) throw new HttpError(404, 'Recorrido no encontrado', 'RECORRIDO_NOT_FOUND')

    const existente = await this.plantillaImportada(usuarioId, recorridoId)
    if (existente) return { plantilla: mapPlantilla(existente), ya_existia: true as const }

    const puntos = (recorrido.segmentos as Segmentos).flat()
    if (puntos.length < 2) {
      throw new HttpError(422, 'El recorrido no tiene una traza válida', 'RECORRIDO_SIN_TRAZA')
    }
    const linestring: GeoJsonLineString = {
      type: 'LineString',
      coordinates: puntos.map(([lat, lng]) => [lng, lat]),
    }
    const origen = puntos[0]!
    const destino = puntos[puntos.length - 1]!
    // Longitud del trazado que se va a seguir (une los tramos), no la distancia GPS del autor.
    const distancia = await computeLineStringLengthMeters(this.prisma, linestring)

    try {
      const creada = await this.prisma.rutaPlantilla.create({
        data: {
          usuario_id: usuarioId,
          recorrido_publicado_id: recorrido.id,
          nombre: recorrido.nombre?.trim() || NOMBRE_PLANTILLA_DEFAULT,
          tipo_actividad: recorrido.tipo_actividad,
          origen_lat: origen[0],
          origen_lng: origen[1],
          destino_lat: destino[0],
          destino_lng: destino[1],
          linestring_geojson: linestring as unknown as Prisma.InputJsonValue,
          distancia_planeada_m: distancia,
          tiempo_estimado_seg: recorrido.tiempo_seg,
        },
        include: { paradas: { orderBy: { orden: 'asc' } } },
      })
      return { plantilla: mapPlantilla(creada), ya_existia: false as const }
    } catch (err) {
      // Carrera concurrente: unique (usuario, recorrido_publicado).
      if (esUniqueViolation(err)) {
        const reintento = await this.plantillaImportada(usuarioId, recorridoId)
        if (reintento) return { plantilla: mapPlantilla(reintento), ya_existia: true as const }
      }
      throw err
    }
  }

  private plantillaImportada(usuarioId: string, recorridoId: string) {
    return this.prisma.rutaPlantilla.findUnique({
      where: {
        usuario_id_recorrido_publicado_id: {
          usuario_id: usuarioId,
          recorrido_publicado_id: recorridoId,
        },
      },
      include: { paradas: { orderBy: { orden: 'asc' } } },
    })
  }
}
