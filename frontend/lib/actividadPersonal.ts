import type { TipoActividadApi, ViajeFinalizadoApi } from './viajesApi'

/**
 * Cuentas sobre los viajes finalizados propios para Perfil y Estadísticas.
 *
 * Solo cuentan los viajes con métrica propia (`mi_distancia_m != null`): es el mismo
 * criterio con el que el backend suma la racha (RN-075) y los km, así la tira de
 * semanas y los totales no se contradicen. Semanas y meses se cortan en hora
 * argentina (RN-105), como `semanaDe` en `rachas.service.ts`.
 */

const OFFSET_ARG_MS = 3 * 3_600_000
const MS_DIA = 86_400_000

/** Campos UTC del instante desplazado = fecha y hora argentina. */
function enArg(instante: Date): Date {
  return new Date(instante.getTime() - OFFSET_ARG_MS)
}

/** Lunes 00:00 (ART) de la semana del instante, como número comparable (campos ART en UTC). */
function lunesDe(instante: Date): number {
  const d = enArg(instante)
  const desdeLunes = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - desdeLunes)
}

function fechaDe(v: ViajeFinalizadoApi): Date {
  return new Date(v.fecha_fin_real ?? v.fecha_programada)
}

function conMetrica(viajes: ViajeFinalizadoApi[]): ViajeFinalizadoApi[] {
  return viajes.filter((v) => v.mi_distancia_m != null)
}

export type SemanaActividad = {
  /** Lunes de esa semana (instante real, a medianoche ART). */
  inicio: Date
  activa: boolean
}

/** Últimas `cantidad` semanas, de la más vieja a la actual (la última es esta semana). */
export function semanasRecientes(
  viajes: ViajeFinalizadoApi[],
  ahora: Date,
  cantidad = 8
): SemanaActividad[] {
  const activas = new Set(conMetrica(viajes).map((v) => lunesDe(fechaDe(v))))
  const actual = lunesDe(ahora)
  return Array.from({ length: cantidad }, (_, i) => {
    const lunes = actual - (cantidad - 1 - i) * 7 * MS_DIA
    return { inicio: new Date(lunes + OFFSET_ARG_MS), activa: activas.has(lunes) }
  })
}

export type MesActividad = {
  /** Día 1 del mes (instante real, a medianoche ART). */
  inicio: Date
  metros: number
  viajes: number
}

/** Últimos `cantidad` meses, del más viejo al actual, aunque no tengan viajes. */
export function mesesRecientes(
  viajes: ViajeFinalizadoApi[],
  ahora: Date,
  cantidad = 6
): MesActividad[] {
  const hoy = enArg(ahora)
  const meses = Array.from({ length: cantidad }, (_, i) => {
    const clave = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (cantidad - 1 - i), 1)
    return { clave, inicio: new Date(clave + OFFSET_ARG_MS), metros: 0, viajes: 0 }
  })
  const porClave = new Map(meses.map((m) => [m.clave, m]))
  for (const v of conMetrica(viajes)) {
    const d = enArg(fechaDe(v))
    const mes = porClave.get(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    if (!mes) continue
    mes.metros += v.mi_distancia_m ?? 0
    mes.viajes += 1
  }
  return meses.map(({ inicio, metros, viajes: n }) => ({ inicio, metros, viajes: n }))
}

export type TotalActividad = {
  tipo: TipoActividadApi
  metros: number
  segundos: number
  viajes: number
}

/**
 * Totales propios por modalidad, de mayor a menor distancia. Es el historial de la
 * persona, no una comparación con otros: no incluye velocidades (RN-070).
 */
export function totalesPorActividad(viajes: ViajeFinalizadoApi[]): TotalActividad[] {
  const porTipo = new Map<TipoActividadApi, TotalActividad>()
  for (const v of conMetrica(viajes)) {
    const t = porTipo.get(v.tipo_actividad) ?? {
      tipo: v.tipo_actividad,
      metros: 0,
      segundos: 0,
      viajes: 0,
    }
    t.metros += v.mi_distancia_m ?? 0
    t.segundos += v.mi_tiempo_movimiento_seg ?? 0
    t.viajes += 1
    porTipo.set(v.tipo_actividad, t)
  }
  return [...porTipo.values()].sort((a, b) => b.metros - a.metros || b.viajes - a.viajes)
}
