import { Feather } from '@expo/vector-icons'

import { ETIQUETA_ACTIVIDAD } from '@/components/admin/AdminUI'
import type { InsigniaApi } from '@/lib/insigniasApi'

/**
 * Íconos de Feather que se ofrecen al crear una insignia (RN-133). Se filtran contra el
 * glyphMap para no ofrecer uno que la versión instalada no tenga.
 */
export const ICONOS_INSIGNIA = (
  [
    'award',
    'flag',
    'star',
    'zap',
    'target',
    'trending-up',
    'clock',
    'watch',
    'map',
    'map-pin',
    'compass',
    'navigation',
    'globe',
    'sun',
    'moon',
    'sunrise',
    'wind',
    'droplet',
    'feather',
    'heart',
    'shield',
    'anchor',
    'activity',
    'gift',
    'thumbs-up',
    'hexagon',
    'triangle',
    'coffee',
    'camera',
    'users',
  ] as const
).filter((nombre) => nombre in Feather.glyphMap)

/** Número con coma decimal, como se escribe en Argentina ("21,1"). */
export function formatearDecimal(valor: number): string {
  return String(Math.round(valor * 1000) / 1000).replace('.', ',')
}

/** Lee "21,1" o "21.1". Vacío → null; inválido → NaN. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!limpio) return null
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : NaN
}

function duracion(seg: number): string {
  const h = Math.floor(seg / 3600)
  const min = Math.round((seg % 3600) / 60)
  if (h === 0) return `${min} min`
  return min === 0 ? `${h} h` : `${h} h ${min} min`
}

/** Resumen legible de los criterios (RN-074): todos los que no son null tienen que cumplirse. */
export function describirCriterios(
  i: Pick<InsigniaApi, 'criterio_distancia_m' | 'criterio_duracion_seg' | 'criterio_actividad'>
): string {
  const partes: string[] = []
  if (i.criterio_actividad) partes.push(ETIQUETA_ACTIVIDAD[i.criterio_actividad] ?? i.criterio_actividad)
  if (i.criterio_distancia_m != null) partes.push(`${formatearDecimal(i.criterio_distancia_m / 1000)} km o más`)
  if (i.criterio_duracion_seg != null) partes.push(`${duracion(i.criterio_duracion_seg)} en movimiento`)
  return partes.length > 0 ? partes.join(' · ') : 'Sin criterios: al finalizar el primer viaje'
}

/** Sugerencia de código a partir del nombre: "Media maratón" → "media_maraton". */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '')
}
