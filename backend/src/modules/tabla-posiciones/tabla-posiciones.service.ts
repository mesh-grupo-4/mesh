import type { PrismaClient, TipoActividad } from '@prisma/client'
import { diaArg, inicioDiaArg, inicioBalde } from '../reportes/reportes.periodo'
import type {
  OrdenRanking,
  PeriodoRanking,
  TipoActividadRanking,
} from './tabla-posiciones.schemas'

function nombreDe(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || 'Un integrante'
}

/** Inicio (00:00 ART) del período vigente que contiene a `ahora`. */
function inicioPeriodo(periodo: PeriodoRanking, ahora: Date): Date {
  const hoy = diaArg(ahora)
  if (periodo === 'semanal') return inicioDiaArg(inicioBalde(hoy, 'semana'))
  if (periodo === 'mensual') return inicioDiaArg(`${hoy.slice(0, 7)}-01`)
  return inicioDiaArg(`${hoy.slice(0, 4)}-01-01`)
}

export type FilaTablaPosiciones = {
  puesto: number
  usuario_id: string
  nombre: string
  distancia_m: number
  tiempo_movimiento_seg: number
}

const TOP_N = 3

/**
 * RN-076: tabla de posiciones global por tipo de actividad y período, ordenada
 * por distancia o tiempo en movimiento — nunca por velocidad (RN-070). La
 * modalidad moto queda afuera por completo: `tipoActividad` solo acepta
 * bici/running/trekking/otro (ver `tabla-posiciones.schemas.ts`).
 */
export class TablaPosicionesService {
  constructor(private readonly prisma: PrismaClient) {}

  async obtener(
    usuarioId: string,
    tipoActividad: TipoActividadRanking,
    periodo: PeriodoRanking,
    orden: OrdenRanking,
    ahora: Date = new Date()
  ) {
    const desde = inicioPeriodo(periodo, ahora)

    const viajes = await this.prisma.viaje.findMany({
      where: {
        tipo_actividad: tipoActividad as TipoActividad,
        estado: 'finalizado',
        fecha_fin_real: { gte: desde },
      },
      select: { id: true },
    })

    const vacio = {
      tipo_actividad: tipoActividad,
      periodo,
      orden,
      desde: desde.toISOString(),
      top: [] as FilaTablaPosiciones[],
      mi_posicion: null as FilaTablaPosiciones | null,
      total_participantes: 0,
    }
    if (viajes.length === 0) return vacio

    const agrupado = await this.prisma.metricaViaje.groupBy({
      by: ['usuario_id'],
      where: { viaje_id: { in: viajes.map((v) => v.id) } },
      _sum: { distancia_m: true, tiempo_movimiento_seg: true },
      orderBy:
        orden === 'distancia'
          ? { _sum: { distancia_m: 'desc' } }
          : { _sum: { tiempo_movimiento_seg: 'desc' } },
    })
    if (agrupado.length === 0) return vacio

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: agrupado.map((g) => g.usuario_id) } },
      select: { id: true, nombre: true, apellido: true },
    })
    const nombrePor = new Map(usuarios.map((u) => [u.id, nombreDe(u)]))

    const filas: FilaTablaPosiciones[] = agrupado.map((g, i) => ({
      puesto: i + 1,
      usuario_id: g.usuario_id,
      nombre: nombrePor.get(g.usuario_id) ?? 'Un integrante',
      distancia_m: g._sum.distancia_m ?? 0,
      tiempo_movimiento_seg: g._sum.tiempo_movimiento_seg ?? 0,
    }))

    return {
      tipo_actividad: tipoActividad,
      periodo,
      orden,
      desde: desde.toISOString(),
      top: filas.slice(0, TOP_N),
      mi_posicion: filas.find((f) => f.usuario_id === usuarioId) ?? null,
      total_participantes: filas.length,
    }
  }
}
