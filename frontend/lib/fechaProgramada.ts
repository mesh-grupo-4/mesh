/** Margen mínimo al ajustar una fecha que quedó en el pasado (p. ej. al elegir “hoy”). */
const MARGEN_FUTURO_MS = 5 * 60 * 1000

export function esFechaFutura(d: Date, now: Date = new Date()): boolean {
  return d.getTime() > now.getTime()
}

/**
 * Tras elegir solo el día (Android/web), la hora previa puede quedar en el pasado.
 * Si pasó, avanza a “ahora + margen” para que el time picker parta de un valor válido.
 */
export function ajustarSiQuedoEnPasado(d: Date, now: Date = new Date()): Date {
  if (esFechaFutura(d, now)) return d
  return new Date(now.getTime() + MARGEN_FUTURO_MS)
}
