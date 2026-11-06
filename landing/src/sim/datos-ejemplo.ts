// Integrantes ficticios. Sin conexión con el backend ni datos de personas reales (plan, 2.5).
import type { Integrante } from './estado'

export const LIDER = 'Vale'

const base = (id: string, nombre: string, progreso: number): Integrante => ({
  id,
  nombre,
  estado: 'en_movimiento',
  incidencia: 'ninguna',
  progreso,
  offset: 0,
})

export const INTEGRANTES_EJEMPLO: readonly Integrante[] = [
  base('vale', 'Vale', 0.68),
  base('nico', 'Nico', 0.61),
  base('gonza', 'Gonza', 0.54),
  base('tomi', 'Tomi', 0.47),
  base('cami', 'Cami', 0.40),
  base('flor', 'Flor', 0.33),
]
