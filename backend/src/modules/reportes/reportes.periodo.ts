/**
 * Período y series temporales de la reportería (RN-128).
 *
 * Todo se agrupa en hora argentina (UTC-3 fija, RN-105): un viaje que arranca el
 * lunes a las 22:00 en Córdoba cuenta para el lunes, aunque en UTC ya sea martes.
 * Los instantes siguen viajando en UTC; acá solo se decide en qué balde cae cada uno.
 */

export type Granularidad = 'dia' | 'semana' | 'mes'

export type Periodo = {
  /** Instante UTC de inicio (inclusive): 00:00 ART del primer día. */
  desde: Date
  /** Instante UTC de fin (exclusivo): 00:00 ART del día siguiente al último. */
  hasta: Date
  /** Fechas calendario ART tal como las pidió (o se resolvieron por defecto). */
  desdeDia: string
  hastaDia: string
  granularidad: Granularidad
}

export const OFFSET_ARG_HORAS = 3
const MS_DIA = 86_400_000
export const DIAS_POR_DEFECTO = 90
export const DIAS_MAXIMOS = 731

/** `Date` UTC → fecha calendario argentina `YYYY-MM-DD`. */
export function diaArg(instante: Date): string {
  return new Date(instante.getTime() - OFFSET_ARG_HORAS * 3_600_000).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` (ART) → instante UTC de las 00:00 ART de ese día. */
export function inicioDiaArg(dia: string): Date {
  return new Date(`${dia}T00:00:00.000-03:00`)
}

function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10)
}

function granularidadPorDefecto(dias: number): Granularidad {
  if (dias <= 45) return 'dia'
  if (dias <= 180) return 'semana'
  return 'mes'
}

/**
 * Resuelve el período pedido. Sin `desde`/`hasta` toma los últimos 90 días hasta
 * hoy (ART). Sin granularidad elige la que da una serie legible: días hasta ~6
 * semanas, semanas hasta ~6 meses, meses de ahí en más.
 */
export function resolverPeriodo(
  q: { desde?: string; hasta?: string; granularidad?: Granularidad },
  ahora: Date = new Date()
): Periodo {
  const hastaDia = q.hasta ?? diaArg(ahora)
  const desdeDia = q.desde ?? sumarDias(hastaDia, -(DIAS_POR_DEFECTO - 1))
  const dias = Math.round((Date.parse(hastaDia) - Date.parse(desdeDia)) / MS_DIA) + 1
  return {
    desde: inicioDiaArg(desdeDia),
    hasta: inicioDiaArg(sumarDias(hastaDia, 1)),
    desdeDia,
    hastaDia,
    granularidad: q.granularidad ?? granularidadPorDefecto(dias),
  }
}

/** Período inmediatamente anterior y de la misma duración, para comparar KPIs. */
export function periodoAnterior(p: Periodo): Periodo {
  const duracion = p.hasta.getTime() - p.desde.getTime()
  const desde = new Date(p.desde.getTime() - duracion)
  return {
    desde,
    hasta: p.desde,
    desdeDia: diaArg(desde),
    hastaDia: diaArg(new Date(p.desde.getTime() - 1)),
    granularidad: p.granularidad,
  }
}

/** Inicio del balde (ART) que contiene a `dia`, como lo calcula `date_trunc` en SQL. */
export function inicioBalde(dia: string, g: Granularidad): string {
  if (g === 'dia') return dia
  if (g === 'mes') return `${dia.slice(0, 7)}-01`
  // date_trunc('week') arranca el lunes (ISO).
  const dow = new Date(`${dia}T00:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(dia, -((dow + 6) % 7))
}

/** Claves de todos los baldes del período, en orden, aunque no tengan datos. */
export function clavesSerie(p: Periodo): string[] {
  const claves: string[] = []
  let actual = inicioBalde(p.desdeDia, p.granularidad)
  while (actual <= p.hastaDia) {
    claves.push(actual)
    if (p.granularidad === 'dia') actual = sumarDias(actual, 1)
    else if (p.granularidad === 'semana') actual = sumarDias(actual, 7)
    else {
      const [a, m] = actual.split('-').map(Number)
      actual = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
    }
  }
  return claves
}

/**
 * Une varias series `{ balde, valor }` en una sola tabla con todas las claves del
 * período, rellenando con 0 los baldes sin datos. Un gráfico con huecos miente:
 * un mes sin viajes es un dato, no una ausencia de dato.
 */
export function completarSerie<K extends string>(
  claves: string[],
  series: Record<K, { balde: string; valor: number }[]>
): ({ balde: string } & Record<K, number>)[] {
  const indices = Object.fromEntries(
    Object.entries(series).map(([nombre, filas]) => [
      nombre,
      new Map((filas as { balde: string; valor: number }[]).map((f) => [f.balde, f.valor])),
    ])
  ) as Record<K, Map<string, number>>
  return claves.map((balde) => {
    const fila = { balde } as { balde: string } & Record<K, number>
    for (const nombre of Object.keys(indices) as K[]) {
      ;(fila as Record<K, number>)[nombre] = indices[nombre].get(balde) ?? 0
    }
    return fila
  })
}

/** Proporción 0–1 redondeada a 4 decimales; null si no hay base para calcularla. */
export function tasa(parte: number, total: number): number | null {
  if (!total) return null
  return Math.round((parte / total) * 10_000) / 10_000
}

/** Variación porcentual contra el período anterior; null si antes era 0. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round(((actual - anterior) / anterior) * 1000) / 10
}

export function kpi(actual: number, anterior: number) {
  return { actual, anterior, variacion_pct: variacion(actual, anterior) }
}

export function redondear(n: number | null | undefined, decimales = 1): number | null {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

/**
 * Matriz de cohortes de retención: por cada mes de alta, qué proporción de esas
 * personas participó en al menos un viaje en el mes 0, 1, 2… desde su alta.
 * Los meses que todavía no ocurrieron quedan en null (no en 0).
 */
export function armarMatrizCohortes(
  cohortes: { cohorte: string; tamano: number }[],
  actividad: { cohorte: string; mes_offset: number; activos: number }[],
  mesActual: string
) {
  const porCohorte = new Map<string, Map<number, number>>()
  for (const a of actividad) {
    if (!porCohorte.has(a.cohorte)) porCohorte.set(a.cohorte, new Map())
    porCohorte.get(a.cohorte)!.set(a.mes_offset, a.activos)
  }
  const indiceMes = (m: string) => {
    const [anio, mes] = m.split('-').map(Number)
    return anio * 12 + mes
  }
  const maxOffset = cohortes.reduce(
    (max, c) => Math.max(max, indiceMes(mesActual) - indiceMes(c.cohorte)),
    0
  )
  return cohortes.map((c) => {
    const transcurridos = indiceMes(mesActual) - indiceMes(c.cohorte)
    const meses: (number | null)[] = []
    for (let k = 0; k <= maxOffset; k++) {
      meses.push(k > transcurridos ? null : tasa(porCohorte.get(c.cohorte)?.get(k) ?? 0, c.tamano) ?? 0)
    }
    return { cohorte: c.cohorte, tamano: c.tamano, retencion: meses }
  })
}
