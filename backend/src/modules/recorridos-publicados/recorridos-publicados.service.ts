import { Prisma } from '@prisma/client'
import type { PrismaClient, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString } from '../../lib/geo'
import { HttpError } from '../../lib/httpError'
import { computeLineStringLengthMeters, computeTrazaRecorrido } from '../../lib/postgis'
import { mapPlantilla } from '../rutas-compartidas/rutas-compartidas.service'
import { aReputacion, type ReputacionAutor } from './recorridos-publicados.reputacion'

type Segmentos = [number, number][][]

/** SCRUM-62: centro y radio de la zona geográfica a explorar. */
export type ZonaBusqueda = { lat: number; lng: number; radioKm: number }

/** Nombre por defecto de una plantilla importada si el recorrido no tenía nombre. */
const NOMBRE_PLANTILLA_DEFAULT = 'Recorrido de la comunidad'

/**
 * RN-082: un recorrido es "Muy recomendado" con este porcentaje de "Recomiendo" y esta
 * cantidad mínima de votos (con pocos votos un porcentaje alto no dice nada). Los muy
 * recomendados van primero en el listado.
 */
const MIN_VOTOS_MUY_RECOMENDADO = 3
const MIN_PORCENTAJE_MUY_RECOMENDADO = 80

/**
 * RN-082 / SCRUM-63: resumen de la valoración de la comunidad. `porcentaje_recomienda` es
 * entero (0–100) o `null` si nadie valoró todavía. `mi_valoracion` es la de quien consulta.
 */
export type ResumenValoracion = {
  recomiendan: number
  no_recomiendan: number
  total: number
  porcentaje_recomienda: number | null
  muy_recomendado: boolean
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
    // Misma cuenta entera que el ORDER BY de `idsOrdenados`: la cinta y el orden coinciden.
    muy_recomendado:
      total >= MIN_VOTOS_MUY_RECOMENDADO &&
      recomiendan * 100 >= total * MIN_PORCENTAJE_MUY_RECOMENDADO,
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
  comentario: string | null
  checklist: string[]
  usuario: { id: string; nombre: string; apellido: string | null }
}

/**
 * Solo distancia y tiempo: nunca velocidad (RN-070). Un recorrido en moto o auto se puede
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
    comentario: r.comentario,
    tiene_checklist: r.checklist.length > 0,
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
  comentario: true,
  checklist: true,
  usuario: { select: { id: true, nombre: true, apellido: true } },
} as const

type FiltrosListado = {
  tipoActividad?: TipoActividad
  zona?: ZonaBusqueda
  q?: string
  limit: number
  offset: number
}

export class RecorridosPublicadosService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-081: publica un viaje del historial propio (finalizado y en el que el usuario
   * participó, incluido quien salió a mitad). Congela un snapshot de SU traza y SUS
   * métricas. Idempotente: republicar refresca el snapshot y reactiva el recorrido.
   * El comentario y el checklist también son parte del snapshot: se reemplazan al republicar.
   */
  async publicar(
    usuarioId: string,
    viajeId: string,
    opciones: { comentario?: string | null; compartirChecklist?: boolean } = {}
  ) {
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

    const [metrica, segmentos, checklist] = await Promise.all([
      this.prisma.metricaViaje.findUnique({
        where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
        select: { distancia_m: true, tiempo_movimiento_seg: true },
      }),
      computeTrazaRecorrido(this.prisma, viajeId, usuarioId),
      opciones.compartirChecklist ? this.textosChecklist(viajeId, usuarioId) : [],
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
      comentario: opciones.comentario ?? null,
      checklist,
    }
    const publicado = await this.prisma.recorridoPublicado.upsert({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      create: { viaje_id: viajeId, usuario_id: usuarioId, ...datos },
      update: { ...datos, activo: true, publicado_at: new Date() },
      select: SELECT_RESUMEN,
    })
    return aResumen(publicado)
  }

  /** Solo los textos: el tilde de `completado` es del viaje de quien publica. */
  private async textosChecklist(viajeId: string, usuarioId: string): Promise<string[]> {
    const items = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      orderBy: [{ orden: 'asc' }, { created_at: 'asc' }],
      select: { texto: true },
    })
    return items.map((i) => i.texto)
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
   * Visibles para todos los usuarios autenticados (RN-081). Primero los muy recomendados
   * (RN-082) y, dentro de cada grupo, el más reciente primero.
   * SCRUM-62: filtrables por actividad, por zona (recorridos que arrancan dentro del radio)
   * y por texto (nombre, comentario o autor).
   */
  async listar(usuarioId: string, filtros: FiltrosListado) {
    const resumenes = await this.listarResumenes(filtros)
    const [valoraciones, reputaciones] = await Promise.all([
      this.valoraciones(
        usuarioId,
        resumenes.map((r) => r.id)
      ),
      this.reputaciones(resumenes.map((r) => r.autor.id)),
    ])
    // Sin reputación = la cuenta se borró entre las dos consultas (y con ella, su recorrido).
    return resumenes.flatMap((r) => {
      const reputacion_autor = reputaciones.get(r.autor.id)
      return reputacion_autor
        ? [{ ...r, valoracion: valoraciones.get(r.id)!, reputacion_autor }]
        : []
    })
  }

  /** Antigüedad, racha e insignias de toda la página de autores en una sola consulta. */
  private async reputaciones(autorIds: string[]): Promise<Map<string, ReputacionAutor>> {
    if (autorIds.length === 0) return new Map()
    const filas = await this.prisma.usuario.findMany({
      where: { id: { in: [...new Set(autorIds)] } },
      select: {
        id: true,
        created_at: true,
        racha: { select: { semanas_consecutivas: true, ultima_actividad: true } },
        insignias: {
          select: { insignia: { select: { codigo: true, nombre: true, icono: true } } },
          orderBy: { obtenida_at: 'desc' },
        },
      },
    })
    return new Map(filas.map((f) => [f.id, aReputacion(f)]))
  }

  private async listarResumenes(filtros: FiltrosListado) {
    const ids = await this.idsOrdenados(filtros)
    if (ids.length === 0) return []
    const filas = await this.prisma.recorridoPublicado.findMany({
      where: { id: { in: ids } },
      select: SELECT_RESUMEN,
    })
    // `in` no respeta el orden: se restituye el de la consulta ordenada.
    const porId = new Map(filas.map((f) => [f.id, f]))
    return ids.flatMap((id) => {
      const fila = porId.get(id)
      return fila ? [aResumen(fila)] : []
    })
  }

  /**
   * Ids de la página pedida, ya filtrados y ordenados. El orden se resuelve en la base para
   * que la paginación lo respete: muy recomendados primero (RN-082), después por fecha. Usa
   * solo la valoración de la comunidad sobre la ruta, nunca velocidad ni rendimiento (RN-070).
   *
   * El cálculo espacial lo hace PostGIS (ST_DWithin sobre geography, en metros). La
   * búsqueda ignora mayúsculas y acentos: "cordoba" encuentra "Córdoba".
   */
  private async idsOrdenados(filtros: FiltrosListado): Promise<string[]> {
    const { zona, q } = filtros
    const filtroActividad = filtros.tipoActividad
      ? Prisma.sql`AND tipo_actividad = ${filtros.tipoActividad}::"TipoActividad"`
      : Prisma.empty
    const filtroZona = zona
      ? Prisma.sql`
          AND inicio_lat IS NOT NULL
          AND inicio_lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(inicio_lng, inicio_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${zona.lng}::float8, ${zona.lat}::float8), 4326)::geography,
            ${zona.radioKm * 1000}::float8
          )`
      : Prisma.empty
    // strpos y no LIKE: un "%" o "_" en la búsqueda no actúa como comodín.
    const filtroTexto = q
      ? Prisma.sql`
          AND strpos(
            translate(
              lower(concat_ws(' ', nombre, comentario, (
                SELECT concat_ws(' ', u.nombre, u.apellido)
                FROM usuario u
                WHERE u.id = recorrido_publicado.usuario_id
              ))),
              'áéíóúüñ',
              'aeiouun'
            ),
            translate(lower(${q}::text), 'áéíóúüñ', 'aeiouun')
          ) > 0`
      : Prisma.empty
    const filas = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT recorrido_publicado.id::text AS id
        FROM recorrido_publicado
        LEFT JOIN (
          SELECT
            recorrido_publicado_id,
            count(*) AS total,
            count(*) FILTER (WHERE recomiendo) AS recomiendan
          FROM valoracion_recorrido
          GROUP BY recorrido_publicado_id
        ) v ON v.recorrido_publicado_id = recorrido_publicado.id
        WHERE activo
          ${filtroActividad}
          ${filtroZona}
          ${filtroTexto}
        ORDER BY
          (
            COALESCE(v.total, 0) >= ${MIN_VOTOS_MUY_RECOMENDADO}::int
            AND v.recomiendan * 100 >= v.total * ${MIN_PORCENTAJE_MUY_RECOMENDADO}::int
          ) DESC,
          publicado_at DESC
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
      checklist: r.checklist,
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
   * recorrido publicado no las tiene. Idempotente por (usuario, recorrido): volver a
   * guardarlo solo actualiza si la plantilla se queda o no con el checklist.
   */
  async importar(
    usuarioId: string,
    recorridoId: string,
    opciones: { guardarChecklist?: boolean } = {}
  ) {
    const recorrido = await this.prisma.recorridoPublicado.findFirst({
      where: { id: recorridoId, activo: true },
      select: {
        id: true,
        nombre: true,
        tipo_actividad: true,
        tiempo_seg: true,
        segmentos: true,
        checklist: true,
      },
    })
    if (!recorrido) throw new HttpError(404, 'Recorrido no encontrado', 'RECORRIDO_NOT_FOUND')

    const checklist = opciones.guardarChecklist ? recorrido.checklist : []
    const existente = await this.plantillaImportada(usuarioId, recorridoId)
    if (existente) {
      const plantilla =
        existente.checklist.join('\n') === checklist.join('\n')
          ? existente
          : await this.prisma.rutaPlantilla.update({
              where: { id: existente.id },
              data: { checklist },
              include: { paradas: { orderBy: { orden: 'asc' } } },
            })
      return { plantilla: mapPlantilla(plantilla), ya_existia: true as const }
    }

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
          checklist,
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
