// Valores de reglas-de-negocio.md §8 y motorEventos.config.ts.
// La velocidad se omite a propósito (plan, sección 2.1): no agregar ese dato acá.
export const ACTIVIDADES = {
  moto: {
    nombre: 'Moto',
    separacionM: 1000,
    toleranciaMin: 10,
    detencionMin: 3,
    interfaz: 'Pantalla completa, alto contraste y botones extra grandes.',
    feedback: 'Visual prominente',
    competencia: false, // RN-070: nunca cambiar
  },
  bici: {
    nombre: 'Bici',
    separacionM: 300,
    toleranciaMin: 5,
    detencionMin: 3,
    interfaz: 'Pantalla outdoor, botones grandes.',
    feedback: 'Visual + vibración',
    competencia: true,
  },
  running: {
    nombre: 'Running',
    separacionM: 100,
    toleranciaMin: 3,
    detencionMin: 4,
    interfaz: 'Pantalla outdoor, sin distracciones.',
    feedback: 'Vibración primero',
    competencia: true,
  },
  trekking: {
    nombre: 'Trekking',
    separacionM: 50,
    toleranciaMin: 3,
    detencionMin: 5,
    interfaz: 'Pantalla outdoor, sin distracciones.',
    feedback: 'Vibración primero',
    competencia: true,
  },
} as const

export type ActividadId = keyof typeof ACTIVIDADES
export const IDS_ACTIVIDAD = Object.keys(ACTIVIDADES) as ActividadId[]
