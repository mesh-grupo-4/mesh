import type { PrismaClient, TipoActividad } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { computeTrazaRecorrido } from '../../lib/postgis'

type Segmentos = [number, number][][]

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

    const datos = {
      nombre: viaje.nombre,
      tipo_actividad: viaje.tipo_actividad,
      distancia_m: metrica.distancia_m,
      tiempo_seg: metrica.tiempo_movimiento_seg,
      segmentos,
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

  /** Visibles para todos los usuarios autenticados (RN-081). Más reciente primero. */
  async listar(filtros: { tipoActividad?: TipoActividad; limit: number; offset: number }) {
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

  /** Detalle con la traza para dibujar el mapa. Un recorrido despublicado es 404 para todos. */
  async obtener(recorridoId: string) {
    const r = await this.prisma.recorridoPublicado.findFirst({
      where: { id: recorridoId, activo: true },
      select: { ...SELECT_RESUMEN, segmentos: true },
    })
    if (!r) throw new HttpError(404, 'Recorrido no encontrado', 'RECORRIDO_NOT_FOUND')
    return { ...aResumen(r), segmentos: r.segmentos as Segmentos }
  }
}
