/**
 * Ranking tipo competición (1, 2, 2, 4): mismo valor → mismo puesto;
 * el siguiente se salta. Nulls quedan sin puesto.
 * Mayor valor gana (más km, más tiempo en movimiento, más km/h).
 */
export function puestosCompeticionDesc(
  valores: Array<number | null | undefined>
): Array<number | null> {
  const ranked = valores
    .map((v, i) => ({ i, v: v ?? null }))
    .filter((x): x is { i: number; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v)

  const out: Array<number | null> = valores.map(() => null)
  let puesto = 1
  for (let k = 0; k < ranked.length; k++) {
    if (k > 0 && ranked[k].v !== ranked[k - 1].v) {
      puesto = k + 1
    }
    out[ranked[k].i] = puesto
  }
  return out
}

export type FilaRanking = {
  distancia_m: number | null
  tiempo_movimiento_seg: number | null
  velocidad_promedio_kmh: number | null
}

export function aplicarPuestosRanking<T extends FilaRanking>(
  filas: T[],
  habilitado: boolean
): Array<
  T & {
    puesto_distancia: number | null
    puesto_tiempo: number | null
    puesto_velocidad: number | null
  }
> {
  if (!habilitado) {
    return filas.map((f) => ({
      ...f,
      puesto_distancia: null,
      puesto_tiempo: null,
      puesto_velocidad: null,
    }))
  }

  const d = puestosCompeticionDesc(filas.map((f) => f.distancia_m))
  const t = puestosCompeticionDesc(filas.map((f) => f.tiempo_movimiento_seg))
  const v = puestosCompeticionDesc(filas.map((f) => f.velocidad_promedio_kmh))

  return filas.map((f, i) => ({
    ...f,
    puesto_distancia: d[i] ?? null,
    puesto_tiempo: t[i] ?? null,
    puesto_velocidad: v[i] ?? null,
  }))
}
