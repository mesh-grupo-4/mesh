export type RouteStop = {
  lat: number
  lng: number
  name: string
  type: 'ORIGIN' | 'STOP' | 'DESTINATION'
}

/** Recién a esta distancia (sobre la ruta) una parada se da por pasada. */
const MARGEN_VISITA_M = 60
/** Más lejos que esto de la ruta, llegar hasta ella también suma distancia. */
const FUERA_DE_RUTA_M = 40

export type NextStopInfo = {
  stop: RouteStop
  distanceM: number
  etaSec: number
}

/** Lo mínimo que hace falta saber del avance (ver `AvanceRuta`). */
type Avance = { progresoM: number; distanciaARutaM: number }

/**
 * Próxima parada que todavía no se pasó, con la distancia medida sobre la ruta
 * (no en línea recta). `paradasM` es a cuántos metros de ruta queda cada parada
 * (`ubicarEnOrden`). El origen nunca es "próxima parada".
 */
export function calcNextStop(
  avance: Avance,
  stops: RouteStop[],
  paradasM: number[],
  speedKmh: number
): NextStopInfo | null {
  if (stops.length === 0 || speedKmh <= 0) return null

  let indice = -1
  for (let i = 0; i < stops.length; i++) {
    if (stops[i]!.type === 'ORIGIN') continue
    if ((paradasM[i] ?? 0) > avance.progresoM + MARGEN_VISITA_M) {
      indice = i
      break
    }
  }
  // Ya se pasaron todas: queda el final de la ruta.
  if (indice < 0) indice = stops.length - 1

  const stop = stops[indice]!
  if (stop.type === 'ORIGIN') return null

  const sobreRutaM = Math.max(0, (paradasM[indice] ?? 0) - avance.progresoM)
  const hastaRutaM = avance.distanciaARutaM > FUERA_DE_RUTA_M ? avance.distanciaARutaM : 0
  const distanceM = sobreRutaM + hastaRutaM
  return { stop, distanceM, etaSec: (distanceM / 1000 / speedKmh) * 3600 }
}

/** "Próx. parada: Nombre" o "Destino: Nombre", según a dónde se esté yendo. */
export function etiquetaProximaParada(info: NextStopInfo): string {
  return `${info.stop.type === 'DESTINATION' ? 'Destino' : 'Próx. parada'}: ${info.stop.name}`
}

export function formatEtaLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '< 1 min'
  const totalMin = Math.max(1, Math.round(seconds / 60))
  if (totalMin < 60) return `~${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`
}

export function formatDistanceShort(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
