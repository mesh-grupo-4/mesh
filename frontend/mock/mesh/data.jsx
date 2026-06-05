/* ============================================================
   Mesh — mock data (Spanish, moto, Córdoba AR)
   ============================================================ */

// avatar colors (warm/earthy + a couple cools, all readable on white text)
const AV = ['#d76655', '#c98a3e', '#5f8d6b', '#5577a8', '#9a5ca8', '#3f8d8d', '#b5564f', '#7a6a4f'];
function avColor(seed) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AV[Math.abs(h) % AV.length];
}
function initials(name) {
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

const ME = {
  id: 'u-me', nombre: 'Tomás', apellido: 'Rivero', email: 'tomas.rivero@gmail.com',
  telefono: '351 244-8190', actividad: 'moto',
};

const PEOPLE = [
  { id: 'u-1', nombre: 'Lucía', apellido: 'Funes' },
  { id: 'u-2', nombre: 'Mateo', apellido: 'Ferreyra' },
  { id: 'u-3', nombre: 'Caro', apellido: 'Bustos' },
  { id: 'u-4', nombre: 'Nahuel', apellido: 'Paz' },
  { id: 'u-5', nombre: 'Sofi', apellido: 'Aguirre' },
  { id: 'u-6', nombre: 'Diego', apellido: 'Molina' },
  { id: 'u-7', nombre: 'Vale', apellido: 'Sosa' },
  { id: 'u-8', nombre: 'Joaco', apellido: 'Luna' },
  { id: 'u-9', nombre: 'Pili', apellido: 'Carrizo' },
];
const fullName = (p) => `${p.nombre} ${p.apellido}`;
const byId = (id) => id === ME.id ? ME : PEOPLE.find(p => p.id === id);

const GROUPS = [
  {
    id: 'g-1', nombre: 'Trail Riders Córdoba', rol: 'lider',
    fecha: '2025-09-12', miembros: ['u-me', 'u-1', 'u-2', 'u-4', 'u-6', 'u-8'],
    color: '#d76655', viajes: 14,
  },
  {
    id: 'g-2', nombre: 'Sierras los domingos', rol: 'participante',
    fecha: '2025-06-03', miembros: ['u-me', 'u-3', 'u-5', 'u-7', 'u-9'],
    color: '#5f8d6b', viajes: 31,
  },
  {
    id: 'g-3', nombre: 'Ruta 5 — Altas Cumbres', rol: 'participante',
    fecha: '2026-02-20', miembros: ['u-me', 'u-1', 'u-3', 'u-4', 'u-6'],
    color: '#5577a8', viajes: 4,
  },
];

const INVITES = [
  { id: 'inv-1', grupo: 'Enduro Punilla', de: 'Mateo Ferreyra', origen: 'Trail Riders Córdoba' },
];

const ROLES = {
  'u-me': 'lider', 'u-1': 'participante', 'u-2': 'participante',
  'u-4': 'participante', 'u-6': 'participante', 'u-8': 'participante',
};

// trips
const TRIPS = [
  {
    id: 'v-1', titulo: 'Camino de las Altas Cumbres', actividad: 'moto', estado: 'en_curso',
    grupo: 'Trail Riders Córdoba', fecha: '2026-06-05T09:00:00', salida: 'Villa Carlos Paz',
    destino: 'Mina Clavero', distancia: 92, duracion: '2h 10m', participantes: ['u-me','u-1','u-2','u-4','u-6'],
  },
  {
    id: 'v-2', titulo: 'Vuelta al Lago San Roque', actividad: 'moto', estado: 'planificado',
    grupo: 'Sierras los domingos', fecha: '2026-06-08T08:30:00', salida: 'Córdoba Capital',
    destino: 'Cosquín', distancia: 64, duracion: '1h 30m', participantes: ['u-me','u-3','u-5','u-7'],
  },
  {
    id: 'v-3', titulo: 'Subida al Champaquí', actividad: 'trekking', estado: 'planificado',
    grupo: 'Ruta 5 — Altas Cumbres', fecha: '2026-06-15T06:00:00', salida: 'San Javier',
    destino: 'Cumbre Champaquí', distancia: 18, duracion: '5h 00m', participantes: ['u-me','u-1','u-4'],
  },
  {
    id: 'v-4', titulo: 'Circuito Punilla', actividad: 'moto', estado: 'finalizado',
    grupo: 'Trail Riders Córdoba', fecha: '2026-05-24T09:00:00', salida: 'La Falda',
    destino: 'La Cumbre', distancia: 47, duracion: '1h 05m', participantes: ['u-me','u-2','u-8'],
  },
];

const ACTIVIDADES = [
  { id: 'moto', label: 'Moto', icon: 'moto' },
  { id: 'bici', label: 'Bici', icon: 'bike' },
  { id: 'running', label: 'Running', icon: 'run' },
  { id: 'trekking', label: 'Trekking', icon: 'trek' },
];

// Live ride: riders moving along the route. progress 0..1, speed km/h.
// status: ok | rezagado (lagging) | detenido (stopped)
const LIVE_RIDERS = [
  { id: 'u-me', t: 0.62, speed: 78, status: 'ok', me: true },
  { id: 'u-1',  t: 0.71, speed: 82, status: 'ok' },
  { id: 'u-2',  t: 0.66, speed: 80, status: 'ok' },
  { id: 'u-4',  t: 0.48, speed: 54, status: 'rezagado' },
  { id: 'u-6',  t: 0.30, speed: 0,  status: 'detenido' },
];

const estadoLabel = { en_curso: 'En curso', planificado: 'Planificado', finalizado: 'Finalizado' };

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' });
}
function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

Object.assign(window, {
  ME, PEOPLE, GROUPS, INVITES, ROLES, TRIPS, ACTIVIDADES, LIVE_RIDERS,
  avColor, initials, fullName, byId, estadoLabel, fechaCorta, fechaLarga, hora,
});
