/**
 * Formato de métricas para pantallas de resumen e historial.
 * Para el cronómetro en vivo (HH:MM:SS) y la distancia del panel live seguir
 * usando `formatElapsedHms` y `formatDistanceKm` de `lib/geo/haversine.ts`.
 */

import { formatearEnArg } from '@/lib/tiempoArg'

/** Número con coma decimal, como el resto de la app (montos, es-AR). */
export function conComaDecimal(valor: number, decimales = 1): string {
  return valor.toFixed(decimales).replace('.', ',')
}

/** Duración legible: "45m", "1h 20m". */
export function formatDurationHm(segundos: number | null | undefined): string {
  if (segundos == null || segundos <= 0) return '--'
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (horas === 0) return `${minutos}m`
  return `${horas}h ${minutos}m`
}

/** Distancia en km con un decimal. Devuelve '--' si no hay dato. */
export function formatKm(metros: number | null | undefined): string {
  if (metros == null) return '--'
  return `${conComaDecimal(metros / 1000)} km`
}

/** Km compacto para stats (Inicio/Perfil), sin unidad porque la etiqueta ya dice "Km": "0", "1,2", "120", "1,2k". */
export function formatKmCompact(metros: number): string {
  const km = metros / 1000
  if (km === 0) return '0'
  if (km < 10) return conComaDecimal(km)
  if (km < 1000) return Math.round(km).toString()
  return `${conComaDecimal(km / 1000)}k`
}

/** Velocidad promedio. Devuelve '--' si no hay dato. */
export function formatSpeedKmh(kmh: number | null | undefined): string {
  if (kmh == null) return '--'
  return `${conComaDecimal(kmh)} km/h`
}

/** Metros enteros para desnivel y altitud: "312 m". Devuelve '--' si no hay dato. */
export function formatMetros(metros: number | null | undefined): string {
  if (metros == null) return '--'
  return `${Math.round(metros)} m`
}

/** Hora corta en UTC-3, para "saliste a las HH:MM". */
export function formatHoraCorta(iso: string | null | undefined): string {
  return formatearEnArg(iso, { hour: '2-digit', minute: '2-digit' })
}

/** Ritmo en min:ss /km. Devuelve '--' si no hay dato o valores inválidos. */
export function formatPace(
  tiempoMovSeg: number | null | undefined,
  distanciaM: number | null | undefined
): string {
  if (tiempoMovSeg == null || distanciaM == null || tiempoMovSeg <= 0 || distanciaM <= 0) return '--'
  const minPorKm = tiempoMovSeg / 60 / (distanciaM / 1000)
  const mins = Math.floor(minPorKm)
  const secs = Math.round((minPorKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /km`
}

/** Ritmo a partir de min/km ya calculados (RN-065, panel en vivo y splits). */
export function formatPaceMinKm(minPorKm: number | null | undefined): string {
  if (minPorKm == null || !Number.isFinite(minPorKm) || minPorKm <= 0) return '--'
  const mins = Math.floor(minPorKm)
  const secs = Math.round((minPorKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')} /km`
}

/** Diferencia con signo, para comparar sesiones ("+1,2 km", "−0:15 /km"). */
export function formatDeltaKm(metros: number | null | undefined): string {
  if (metros == null) return '--'
  const signo = metros >= 0 ? '+' : '−'
  return `${signo}${conComaDecimal(Math.abs(metros) / 1000)} km`
}

export function formatDeltaPace(minPorKm: number | null | undefined): string {
  if (minPorKm == null) return '--'
  const signo = minPorKm <= 0 ? '−' : '+'
  const abs = Math.abs(minPorKm)
  const mins = Math.floor(abs)
  const secs = Math.round((abs - mins) * 60)
  return `${signo}${mins}:${secs.toString().padStart(2, '0')} /km`
}

const SEPARADOR_MILES = /\B(?=(\d{3})+(?!\d))/g

function conPuntoDeMiles(entero: string): string {
  return entero.replace(SEPARADOR_MILES, '.')
}

/**
 * Monto en formato argentino: punto de miles y coma decimal ("$1.234,50").
 * Los centavos solo se muestran si los hay ("$8.500").
 */
export function formatMonto(monto: number): string {
  const centavos = Math.round(Math.abs(monto) * 100)
  const entero = conPuntoDeMiles(String(Math.floor(centavos / 100)))
  const resto = centavos % 100
  const signo = monto < 0 && centavos > 0 ? '-' : ''
  return `${signo}$${entero}${resto > 0 ? `,${String(resto).padStart(2, '0')}` : ''}`
}

/**
 * Máscara del campo de monto mientras se escribe: agrega el punto de miles y deja
 * una sola coma con hasta dos decimales. Un punto tipeado se toma como coma decimal
 * (hay teclados numéricos que solo ofrecen el punto).
 */
export function enmascararMonto(texto: string): string {
  const tipeado = texto.endsWith('.') ? `${texto.slice(0, -1)},` : texto
  const limpio = tipeado.replace(/[^\d,]/g, '')
  const coma = limpio.indexOf(',')
  const parteEntera = (coma < 0 ? limpio : limpio.slice(0, coma)).replace(/^0+(?=\d)/, '')
  if (coma < 0) return conPuntoDeMiles(parteEntera)
  const decimales = limpio.slice(coma + 1).replace(/,/g, '').slice(0, 2)
  return `${conPuntoDeMiles(parteEntera || '0')},${decimales}`
}

/** Valor numérico de un monto escrito con `enmascararMonto`; `null` si no es un monto válido. */
export function parseMonto(texto: string): number | null {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(normalizado)) return null
  const valor = Number(normalizado)
  return Number.isFinite(valor) ? valor : null
}

/** Monto ya guardado, listo para precargar el campo de edición ("1.234,5" → "1.234,50"). */
export function montoParaEditar(monto: number): string {
  return formatMonto(monto).replace('$', '')
}

/**
 * Distancia acumulada con unidad, para totales: "0 km", "8,4 km", "120 km", "1.240 km".
 * A diferencia de `formatKmCompact`, nunca abrevia con "k" (se confundía con la unidad).
 */
export function formatKmTotal(metros: number): string {
  const km = metros / 1000
  if (km === 0) return '0 km'
  if (km < 10) return `${conComaDecimal(km)} km`
  return `${conPuntoDeMiles(String(Math.round(km)))} km`
}

/** Tiempo acumulado legible: "35m", "4h 20m"; desde 10 h solo horas ("48 h"). */
export function formatHorasTotal(segundos: number): string {
  if (segundos <= 0) return '0 h'
  if (segundos < 10 * 3600) return formatDurationHm(segundos)
  return `${conPuntoDeMiles(String(Math.round(segundos / 3600)))} h`
}
