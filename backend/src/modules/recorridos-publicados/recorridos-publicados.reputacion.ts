import { HITOS_RACHA, calcularRachaVigente } from '../rachas/rachas.service'

/**
 * Reputación de quien publica un recorrido. Sirve solo para destacar la tarjeta: el orden
 * del listado depende de la valoración del recorrido (RN-082), no de quién lo publicó.
 * Nunca usa velocidad ni rendimiento (RN-070).
 */
export type NivelAutor = 'comun' | 'destacado' | 'leyenda'

export type InsigniaDestacada = {
  codigo: string
  nombre: string
  icono: string
  rara: boolean
}

export type ReputacionAutor = {
  miembro_desde: string
  racha_semanas: number
  insignias_total: number
  insignias_destacadas: InsigniaDestacada[]
  nivel: NivelAutor
}

export type FilaReputacion = {
  id: string
  created_at: Date
  racha: { semanas_consecutivas: number; ultima_actividad: Date } | null
  /** Más reciente primero. */
  insignias: { insignia: { codigo: string; nombre: string; icono: string } }[]
}

/**
 * Las más exigentes del catálogo. A propósito no incluye insignias de moto o auto: destacar
 * un logro como "raro" en esas modalidades sería incentivar competencia (RN-070).
 */
const INSIGNIAS_RARAS: ReadonlySet<string> = new Set([
  'media_maraton',
  'centurion_bici',
  'trekker_resistente',
])

const MAX_INSIGNIAS_DESTACADAS = 3
const MS_MES = 30.44 * 86_400_000

const UMBRALES_MESES = [6, 12]
const UMBRALES_INSIGNIAS = [3, 5]
const UMBRALES_RARAS = [1, 2]

const PUNTOS_DESTACADO = 2
const PUNTOS_LEYENDA = 5

function puntos(valor: number, umbrales: readonly number[]): number {
  return umbrales.filter((u) => valor >= u).length
}

export function aReputacion(fila: FilaReputacion, ahora: Date = new Date()): ReputacionAutor {
  const racha = calcularRachaVigente(fila.racha, ahora).semanas_consecutivas
  const insignias = fila.insignias.map(({ insignia }) => ({
    codigo: insignia.codigo,
    nombre: insignia.nombre,
    icono: insignia.icono,
    rara: INSIGNIAS_RARAS.has(insignia.codigo),
  }))
  const raras = insignias.filter((i) => i.rara).length
  const meses = (ahora.getTime() - fila.created_at.getTime()) / MS_MES

  const total =
    puntos(racha, HITOS_RACHA) +
    puntos(meses, UMBRALES_MESES) +
    puntos(insignias.length, UMBRALES_INSIGNIAS) +
    puntos(raras, UMBRALES_RARAS)

  return {
    miembro_desde: fila.created_at.toISOString(),
    racha_semanas: racha,
    insignias_total: insignias.length,
    // `sort` es estable: dentro de cada grupo se conserva "más reciente primero".
    insignias_destacadas: [...insignias]
      .sort((a, b) => Number(b.rara) - Number(a.rara))
      .slice(0, MAX_INSIGNIAS_DESTACADAS),
    nivel: total >= PUNTOS_LEYENDA ? 'leyenda' : total >= PUNTOS_DESTACADO ? 'destacado' : 'comun',
  }
}
