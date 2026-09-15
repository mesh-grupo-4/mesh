/**
 * RN-071 (SCRUM-51): tabla de clasificación en vivo del modo competitivo.
 * Ordena por progreso sobre la ruta planificada y expresa la diferencia con el
 * líder en metros y en tiempo relativo (a la velocidad esperada del viaje).
 * Función pura: el progreso ya viene calculado (PostGIS en el motor / servicio).
 */
export type IntegranteEnRuta = {
  usuarioId: string
  nombre: string
  progresoM: number
  lat: number
  lng: number
  /** ISO de la última posición conocida. */
  actualizadoEn: string
}

export type FilaLeaderboard = IntegranteEnRuta & {
  puesto: number
  /** Metros detrás del líder (0 para el líder). */
  deltaM: number
  /** Segundos detrás del líder a la velocidad esperada del viaje. */
  gapSeg: number
}

export function armarLeaderboard(
  integrantes: IntegranteEnRuta[],
  velocidadEsperadaKmh: number
): FilaLeaderboard[] {
  const ordenados = [...integrantes].sort((a, b) => b.progresoM - a.progresoM)
  const lider = ordenados[0]
  if (!lider) return []
  const mPorSeg = Math.max(0.1, (velocidadEsperadaKmh * 1000) / 3600)

  let puesto = 1
  return ordenados.map((m, i) => {
    // Puestos tipo competición: mismo progreso (±1 m) → mismo puesto.
    if (i > 0 && Math.round(ordenados[i - 1]!.progresoM) !== Math.round(m.progresoM)) {
      puesto = i + 1
    }
    const deltaM = Math.max(0, lider.progresoM - m.progresoM)
    return { ...m, puesto, deltaM, gapSeg: deltaM / mPorSeg }
  })
}
