/**
 * Zona horaria única del sistema: Argentina (UTC-3).
 *
 * El transporte y el almacenamiento siguen siendo instantes UTC en ISO 8601.
 * La conversión a UTC-3 ocurre solo en los bordes: al mostrar una fecha y al
 * interpretar lo que el usuario elige en un date picker.
 */

/** Argentina no aplica horario de verano desde 2009, por lo que el offset es fijo. */
const OFFSET_ARG_MIN = -180

type OpcionesFecha = Omit<Intl.DateTimeFormatOptions, 'timeZone'>

function aDate(valor: Date | string | number): Date | null {
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Formatea un instante en hora argentina.
 *
 * Desplaza el instante y formatea en UTC en lugar de pasar `timeZone:
 * 'America/Argentina/Buenos_Aires'`: la base de datos de zonas horarias de
 * Hermes en Android es incompleta y puede caer de vuelta en la hora local.
 */
export function formatearEnArg(
  valor: Date | string | number | null | undefined,
  opciones: OpcionesFecha,
  fallback = '--'
): string {
  if (valor == null) return fallback
  const d = aDate(valor)
  if (!d) return fallback
  const desplazado = new Date(d.getTime() + OFFSET_ARG_MIN * 60_000)
  return desplazado.toLocaleString('es-AR', { ...opciones, timeZone: 'UTC' })
}

/**
 * Instante real → `Date` cuyos campos locales (`getHours`, `getDate`, ...) son
 * la hora argentina. Es lo que espera un date picker nativo, que siempre lee y
 * escribe en la zona del dispositivo.
 */
export function aCamposArg(instante: Date): Date {
  return new Date(instante.getTime() + (OFFSET_ARG_MIN + instante.getTimezoneOffset()) * 60_000)
}

/** Inversa de `aCamposArg`: campos de hora argentina → instante real. */
export function desdeCamposArg(campos: Date): Date {
  return new Date(campos.getTime() - (OFFSET_ARG_MIN + campos.getTimezoneOffset()) * 60_000)
}

/** "Ahora" expresado en campos de hora argentina. */
export function ahoraEnCamposArg(): Date {
  return aCamposArg(new Date())
}
