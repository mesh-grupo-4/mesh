export const DUR = { micro: 0.18, corta: 0.35, media: 0.6, larga: 0.9, epica: 1.4 }
export const EASE = {
  salida: 'power3.out', // entradas
  entrada: 'power2.in', // salidas
  suave: 'power2.inOut', // cambios de estado
  rebote: 'back.out(1.7)', // ruedas y chips
  elastico: 'elastic.out(1, .55)', // malla al soltarse
  scroll: 'none', // siempre lineal si va atado al scroll
}
export const STAGGER = { palabras: 0.04, tarjetas: 0.08, ruedas: 0.06 }
