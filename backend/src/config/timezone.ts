/**
 * RN-105: la zona horaria del sistema es Argentina (UTC-3).
 *
 * Los instantes se siguen persistiendo y transportando en UTC; fijar `TZ` solo
 * alinea los logs y cualquier `Date#toString` del proceso, de modo que un
 * servidor desplegado en otra región no reporte horas ajenas al usuario.
 */
export const TZ_ARG = 'America/Argentina/Buenos_Aires'

process.env.TZ = process.env.TZ ?? TZ_ARG
