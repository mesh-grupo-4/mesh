import type { CategoriaParada, PrismaClient } from '@prisma/client'

/**
 * RN-134: categorías de parada que se pueden planificar en una ruta. `accidente` queda
 * afuera: nadie la planifica, solo se registra durante el viaje.
 * El orden es el que se muestra en el backoffice.
 */
export const CATEGORIAS_PLANIFICABLES = [
  'combustible',
  'descanso',
  'gastronomia',
  'sanitario',
  'punto_control',
  'otro',
] as const satisfies readonly CategoriaParada[]

export type CategoriaPlanificable = (typeof CATEGORIAS_PLANIFICABLES)[number]

/** Minutos promedio por defecto mientras el superadmin no los redefina. */
const MINUTOS_POR_DEFECTO: Record<CategoriaPlanificable, number> = {
  combustible: 10,
  descanso: 15,
  gastronomia: 45,
  sanitario: 10,
  punto_control: 5,
  otro: 15,
}

export function minutosPorDefecto(categoria: CategoriaPlanificable): number {
  return MINUTOS_POR_DEFECTO[categoria]
}

/** Minutos vigentes por categoría: lo que definió el superadmin o, si no, el defecto. */
export type DuracionesVigentes = Record<CategoriaPlanificable, number>

export function duracionesPorDefecto(): DuracionesVigentes {
  return { ...MINUTOS_POR_DEFECTO }
}

/**
 * Lee las duraciones vigentes. Si la tabla no se puede leer (por ejemplo, el backend
 * se desplegó antes que la migración), rigen los valores por defecto: estimar el
 * tiempo de paradas nunca puede romper la lectura de una ruta.
 */
export async function obtenerDuracionesVigentes(
  prisma: Pick<PrismaClient, 'duracionParada'>
): Promise<DuracionesVigentes> {
  const vigentes = duracionesPorDefecto()
  try {
    const filas = await prisma.duracionParada.findMany({ select: { categoria: true, minutos: true } })
    for (const f of filas) {
      if (f.categoria in vigentes) vigentes[f.categoria as CategoriaPlanificable] = f.minutos
    }
  } catch (err) {
    console.warn('[duracionesParada] No se pudieron leer las duraciones; rigen las por defecto.', err)
  }
  return vigentes
}

/** Segundos que suman las paradas planificadas. Las categorías no planificables cuentan 0. */
export function tiempoParadasSeg(
  categorias: readonly CategoriaParada[],
  duraciones: DuracionesVigentes
): number {
  let minutos = 0
  for (const c of categorias) {
    if (c in duraciones) minutos += duraciones[c as CategoriaPlanificable]
  }
  return minutos * 60
}
