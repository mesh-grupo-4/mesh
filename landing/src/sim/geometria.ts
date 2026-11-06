// Ubica a cada integrante sobre la cinta del simulador. Compartido con el HTML estático.
import type { Ruta } from '../lib/ruta'

export const RUTA_SIM = 'M -30 560 C 130 560 150 430 290 430 C 430 430 410 300 540 280 C 680 260 700 150 930 90'

export function posicion(ruta: Ruta, i: { progreso: number; offset: number }) {
  const p = ruta.punto(i.progreso)
  return { x: p.x + p.nx * i.offset, y: p.y + p.ny * i.offset }
}
