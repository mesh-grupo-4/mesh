/**
 * Pedido pendiente de centrar el mapa en vivo en un punto, p. ej. "Ver en el mapa"
 * desde el historial de alertas. La pantalla en vivo lo consume al recuperar el foco.
 */
type EnfoqueMapa = { viajeId: string; lat: number; lng: number }

let pendiente: EnfoqueMapa | null = null

export function pedirEnfoqueMapa(enfoque: EnfoqueMapa): void {
  pendiente = enfoque
}

/** Devuelve el pedido de este viaje (si hay) y lo descarta: se usa una sola vez. */
export function tomarEnfoqueMapa(viajeId: string): EnfoqueMapa | null {
  if (!pendiente || pendiente.viajeId !== viajeId) return null
  const enfoque = pendiente
  pendiente = null
  return enfoque
}
