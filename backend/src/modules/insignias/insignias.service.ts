import type { PrismaClient, TipoActividad } from '@prisma/client'
import { HttpError } from '../../lib/httpError'

type CriterioInsignia = {
  id: string
  criterio_distancia_m: number | null
  criterio_duracion_seg: number | null
  criterio_actividad: TipoActividad | null
}

type InsigniaConRelaciones = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string
  criterio_distancia_m: number | null
  criterio_duracion_seg: number | null
  criterio_actividad: TipoActividad | null
}

type OtorgadaConRelaciones = {
  id: string
  insignia_id: string
  viaje_id: string | null
  obtenida_at: Date
  insignia: InsigniaConRelaciones
}

/**
 * RN-074: los criterios son independientes entre sí (AND) y opcionales — null
 * significa "no aplica". A propósito no existe (ni debe agregarse) un criterio
 * de velocidad: eso sería gamificación de velocidad, prohibida en moto (RN-070).
 */
function cumpleCriterio(
  insignia: CriterioInsignia,
  tipoActividad: TipoActividad,
  distanciaM: number,
  tiempoMovimientoSeg: number
): boolean {
  if (insignia.criterio_actividad != null && insignia.criterio_actividad !== tipoActividad) {
    return false
  }
  if (insignia.criterio_distancia_m != null && distanciaM < insignia.criterio_distancia_m) {
    return false
  }
  if (insignia.criterio_duracion_seg != null && tiempoMovimientoSeg < insignia.criterio_duracion_seg) {
    return false
  }
  return true
}

export class InsigniasService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-074: evalúa el catálogo contra la métrica de un integrante recién
   * finalizada y otorga automáticamente las insignias que correspondan.
   * Idempotente: una insignia ya obtenida no se vuelve a otorgar ni pisa su
   * fecha original (`skipDuplicates`, respaldado por el unique de la tabla).
   */
  async evaluarYOtorgar(
    usuarioId: string,
    viajeId: string,
    tipoActividad: TipoActividad,
    distanciaM: number,
    tiempoMovimientoSeg: number
  ): Promise<void> {
    const catalogo = await this.prisma.insignia.findMany({
      where: { activa: true },
      select: {
        id: true,
        criterio_distancia_m: true,
        criterio_duracion_seg: true,
        criterio_actividad: true,
      },
    })

    const elegibles = catalogo.filter((i) =>
      cumpleCriterio(i, tipoActividad, distanciaM, tiempoMovimientoSeg)
    )
    if (elegibles.length === 0) return

    await this.prisma.usuarioInsignia.createMany({
      data: elegibles.map((i) => ({ usuario_id: usuarioId, insignia_id: i.id, viaje_id: viajeId })),
      skipDuplicates: true,
    })
  }

  /** Catálogo completo de insignias activas, para mostrar también las que faltan conseguir. */
  async listarCatalogo() {
    const filas = await this.prisma.insignia.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
    })
    return filas.map((f) => this.mapInsignia(f))
  }

  /** Insignias obtenidas por un usuario. Visible para cualquiera (son públicas dentro de la comunidad). */
  async listarDeUsuario(usuarioObjetivoId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioObjetivoId },
      select: { id: true },
    })
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    const filas = await this.prisma.usuarioInsignia.findMany({
      where: { usuario_id: usuarioObjetivoId },
      include: { insignia: true },
      orderBy: { obtenida_at: 'desc' },
    })
    return filas.map((f) => this.mapOtorgada(f))
  }

  private mapInsignia(i: InsigniaConRelaciones) {
    return {
      id: i.id,
      codigo: i.codigo,
      nombre: i.nombre,
      descripcion: i.descripcion,
      icono: i.icono,
      criterio_distancia_m: i.criterio_distancia_m,
      criterio_duracion_seg: i.criterio_duracion_seg,
      criterio_actividad: i.criterio_actividad,
    }
  }

  private mapOtorgada(f: OtorgadaConRelaciones) {
    return {
      id: f.id,
      insignia_id: f.insignia_id,
      codigo: f.insignia.codigo,
      nombre: f.insignia.nombre,
      descripcion: f.insignia.descripcion,
      icono: f.insignia.icono,
      viaje_id: f.viaje_id,
      obtenida_at: f.obtenida_at.toISOString(),
    }
  }
}
