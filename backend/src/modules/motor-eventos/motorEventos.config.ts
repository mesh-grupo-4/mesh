import type { TipoActividad } from '@prisma/client'

export type UmbralesMotor = {
  /** Minutos quieto sin parada manual antes de marcar posible incidente (RN-036). */
  detencionMinutos: number
  /** Radio dentro del cual se considera “quieto” (m). */
  radioDetenidoM: number
  /** Tolerancia de atraso vs. bloque principal (RN-035), en minutos. */
  toleranciaAtrasoMinutos: number
}

const DEFAULTS: UmbralesMotor = {
  detencionMinutos: 4,
  radioDetenidoM: 18,
  toleranciaAtrasoMinutos: 5,
}

const POR_ACTIVIDAD: Record<TipoActividad, UmbralesMotor> = {
  trekking: { detencionMinutos: 5, radioDetenidoM: 12, toleranciaAtrasoMinutos: 3 },
  running: { detencionMinutos: 4, radioDetenidoM: 15, toleranciaAtrasoMinutos: 3 },
  bici: { detencionMinutos: 3, radioDetenidoM: 20, toleranciaAtrasoMinutos: 5 },
  moto: { detencionMinutos: 3, radioDetenidoM: 25, toleranciaAtrasoMinutos: 10 },
  otro: DEFAULTS,
}

export function umbralesMotorPorActividad(tipo: TipoActividad): UmbralesMotor {
  return POR_ACTIVIDAD[tipo] ?? DEFAULTS
}

/** Minutos efectivos de detención antes de marcar posible incidente en un viaje. */
export function minutosIncidenteEfectivo(
  tipo: TipoActividad,
  minutosViaje: number | null | undefined
): number {
  if (minutosViaje != null) return minutosViaje
  return umbralesMotorPorActividad(tipo).detencionMinutos
}

/** Prefijo en `alerta.mensaje` para deduplicar alertas del sistema por integrante. */
export function prefijoAlertaAfectado(usuarioId: string): string {
  return `[afectado:${usuarioId}]`
}

export function mensajeVisible(raw: string): string {
  return raw.replace(/^\[afectado:[0-9a-f-]+\]\s*/i, '')
}
