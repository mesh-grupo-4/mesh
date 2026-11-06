// Compartido entre el HTML estático del hero y su animación.
export const RUTA_HERO =
  'M 60 1320 C 120 1120 340 800 250 600 C 180 460 340 340 500 440 C 660 540 840 470 770 300 C 720 180 820 60 980 20'

/** En su estado final (sin JS), Gonza se está quedando: es la escena que cuenta el problema. */
export const GRUPO_HERO = [
  { nombre: 'Vale', t: 0.8 },
  { nombre: 'Nico', t: 0.75 },
  { nombre: 'Flor', t: 0.7 },
  { nombre: 'Tomi', t: 0.65 },
  { nombre: 'Cami', t: 0.6 },
  { nombre: 'Gonza', t: 0.4 },
] as const

export const INDICE_GONZA = 5

export const MALLA_HERO: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 2], [1, 3], [2, 4],
]
