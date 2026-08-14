/**
 * Formato de métricas para pantallas de resumen e historial.
 * Para el cronómetro en vivo (HH:MM:SS) y la distancia del panel live seguir
 * usando `formatElapsedHms` y `formatDistanceKm` de `lib/geo/haversine.ts`.
 */

import { formatearEnArg } from '@/lib/tiempoArg'

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
  return `${(metros / 1000).toFixed(1)} km`
}

/** Km compacto para stats (Inicio/Perfil): "0", "1.2", "120", "1.2k". */
export function formatKmCompact(metros: number): string {
  const km = metros / 1000
  if (km === 0) return '0'
  if (km < 10) return km.toFixed(1)
  if (km < 1000) return Math.round(km).toString()
  return `${(km / 1000).toFixed(1)}k`
}

/** Velocidad promedio. Devuelve '--' si no hay dato. */
export function formatSpeedKmh(kmh: number | null | undefined): string {
  if (kmh == null) return '--'
  return `${kmh.toFixed(1)} km/h`
}

/** Hora corta en UTC-3, para "saliste a las HH:MM". */
export function formatHoraCorta(iso: string | null | undefined): string {
  return formatearEnArg(iso, { hour: '2-digit', minute: '2-digit' })
}
