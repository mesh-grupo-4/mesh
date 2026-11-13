/**
 * Guion de la demo: quiénes son los usuarios, cómo se relacionan y qué viajes hicieron.
 *
 * Es solo datos. `seed.ts` lo lee y lo convierte en filas; para cambiar lo que se ve
 * en la presentación (un nombre, un viaje, un gasto) se toca este archivo y se vuelve
 * a correr `npm run demo:seed`.
 *
 * Las fechas son relativas al día en que se corre el seed (`haceDias`, `enDias`), así
 * las rachas siguen vigentes y los viajes planificados siguen siendo futuros.
 */
import type {
  CategoriaParada,
  EstadoAlerta,
  ModoViaje,
  OrigenAlerta,
  TipoActividad,
  TipoAlerta,
  VisibilidadLogros,
} from '@prisma/client'

/** Todo lo que crea el seed se reconoce por este dominio; `demo:limpiar` borra solo eso. */
export const DOMINIO_DEMO = 'demo.mesh'
export const PASSWORD_POR_DEFECTO = 'admin1234'
/** Usuario con el que se recorre la app en la presentación. */
export const PROTAGONISTA = 'lucia'

// ── Elenco ───────────────────────────────────────────────────────────────────

export type UsuarioDemo = {
  clave: string
  nombre: string
  apellido: string
  actividad: TipoActividad
  /** Antigüedad de la cuenta. */
  altaHaceDias: number
  /** Se crea también en Firebase y puede iniciar sesión. */
  login?: boolean
  superadmin?: boolean
  visibilidad?: VisibilidadLogros
  /** Semanas seguidas con actividad que el relleno le garantiza (RN-075). */
  rachaSemanas?: number
  /** Cuenta suspendida por el superadmin (RN-123), con este motivo. */
  suspendido?: string
  /** Recién registrado: todavía no aceptó el aviso de ubicación ni hizo viajes. */
  nuevo?: boolean
}

export const ELENCO: UsuarioDemo[] = [
  { clave: 'lucia', nombre: 'Lucía', apellido: 'Fernández', actividad: 'bici', altaHaceDias: 400, login: true, superadmin: true },
  { clave: 'martin', nombre: 'Martín', apellido: 'Acosta', actividad: 'running', altaHaceDias: 300, login: true },
  { clave: 'sofia', nombre: 'Sofía', apellido: 'Pereyra', actividad: 'trekking', altaHaceDias: 210, login: true },

  { clave: 'diego', nombre: 'Diego', apellido: 'Maldonado', actividad: 'trekking', altaHaceDias: 420, rachaSemanas: 14 },
  { clave: 'valentina', nombre: 'Valentina', apellido: 'Ríos', actividad: 'bici', altaHaceDias: 380, rachaSemanas: 9 },
  { clave: 'joaquin', nombre: 'Joaquín', apellido: 'Sosa', actividad: 'moto', altaHaceDias: 350 },
  { clave: 'camila', nombre: 'Camila', apellido: 'Ortiz', actividad: 'running', altaHaceDias: 330, rachaSemanas: 6 },
  { clave: 'nicolas', nombre: 'Nicolás', apellido: 'Bustos', actividad: 'moto', altaHaceDias: 310 },
  { clave: 'florencia', nombre: 'Florencia', apellido: 'Luna', actividad: 'bici', altaHaceDias: 280, rachaSemanas: 4 },
  { clave: 'tomas', nombre: 'Tomás', apellido: 'Ferreyra', actividad: 'auto', altaHaceDias: 260 },
  { clave: 'agustina', nombre: 'Agustina', apellido: 'Molina', actividad: 'running', altaHaceDias: 240, rachaSemanas: 11 },
  { clave: 'facundo', nombre: 'Facundo', apellido: 'Giménez', actividad: 'moto', altaHaceDias: 220 },
  { clave: 'julieta', nombre: 'Julieta', apellido: 'Paz', actividad: 'trekking', altaHaceDias: 200, visibilidad: 'amigos' },
  { clave: 'matias', nombre: 'Matías', apellido: 'Córdoba', actividad: 'bici', altaHaceDias: 180, rachaSemanas: 3 },
  { clave: 'ramiro', nombre: 'Ramiro', apellido: 'Funes', actividad: 'moto', altaHaceDias: 170, suspendido: 'Reportes reiterados por conducta en viajes grupales' },
  { clave: 'carolina', nombre: 'Carolina', apellido: 'Vega', actividad: 'running', altaHaceDias: 160, visibilidad: 'solo_yo' },
  { clave: 'ezequiel', nombre: 'Ezequiel', apellido: 'Ledesma', actividad: 'auto', altaHaceDias: 150 },
  { clave: 'micaela', nombre: 'Micaela', apellido: 'Romero', actividad: 'trekking', altaHaceDias: 130, rachaSemanas: 5 },
  { clave: 'lautaro', nombre: 'Lautaro', apellido: 'Benítez', actividad: 'bici', altaHaceDias: 110 },
  { clave: 'rocio', nombre: 'Rocío', apellido: 'Aguirre', actividad: 'running', altaHaceDias: 95 },
  { clave: 'bruno', nombre: 'Bruno', apellido: 'Castillo', actividad: 'moto', altaHaceDias: 80 },
  { clave: 'antonella', nombre: 'Antonella', apellido: 'Herrera', actividad: 'trekking', altaHaceDias: 75 },
  { clave: 'ignacio', nombre: 'Ignacio', apellido: 'Peralta', actividad: 'bici', altaHaceDias: 45 },
  { clave: 'paula', nombre: 'Paula', apellido: 'Navarro', actividad: 'running', altaHaceDias: 30 },
  { clave: 'santiago', nombre: 'Santiago', apellido: 'Quiroga', actividad: 'auto', altaHaceDias: 18 },
  { clave: 'milagros', nombre: 'Milagros', apellido: 'Domínguez', actividad: 'otro', altaHaceDias: 3, nuevo: true },
]

// ── Grupos, invitaciones y amistades ─────────────────────────────────────────

export type GrupoDemo = {
  clave: string
  nombre: string
  lider: string
  miembros: string[]
  creadoHaceDias: number
}

export const GRUPOS: GrupoDemo[] = [
  { clave: 'moteros', nombre: 'Moteros de las Sierras', lider: 'lucia', miembros: ['martin', 'joaquin', 'nicolas', 'facundo', 'bruno', 'ramiro'], creadoHaceDias: 320 },
  { clave: 'pedal', nombre: 'Pedal Cordobés', lider: 'lucia', miembros: ['sofia', 'valentina', 'florencia', 'matias', 'lautaro', 'ignacio'], creadoHaceDias: 250 },
  { clave: 'runners', nombre: 'Runners del Suquía', lider: 'martin', miembros: ['lucia', 'camila', 'agustina', 'carolina', 'rocio', 'paula', 'sofia'], creadoHaceDias: 290 },
  { clave: 'trekking', nombre: 'Trekking Champaquí', lider: 'diego', miembros: ['lucia', 'sofia', 'julieta', 'micaela', 'antonella'], creadoHaceDias: 400 },
  { clave: 'clasicos', nombre: 'Autos Clásicos Córdoba', lider: 'tomas', miembros: ['ezequiel', 'santiago', 'nicolas', 'joaquin'], creadoHaceDias: 240 },
  { clave: 'gravel', nombre: 'Gravel Punilla', lider: 'valentina', miembros: ['florencia', 'lautaro', 'matias', 'ignacio', 'diego'], creadoHaceDias: 170 },
  { clave: 'caminantes', nombre: 'Caminantes de Calamuchita', lider: 'julieta', miembros: ['micaela', 'antonella', 'diego', 'carolina'], creadoHaceDias: 120 },
  { clave: 'nocturna', nombre: 'Rodada Nocturna', lider: 'facundo', miembros: ['bruno', 'nicolas', 'ezequiel'], creadoHaceDias: 70 },
]

export type InvitacionGrupoDemo = {
  grupo: string
  a: string
  de: string
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  haceDias: number
  /** Grupo desde el que se la invitó ("invitar desde mis grupos"). */
  grupoOrigen?: string
}

export const INVITACIONES_GRUPO: InvitacionGrupoDemo[] = [
  // Las que le llegaron a la protagonista y todavía no respondió.
  { grupo: 'clasicos', a: 'lucia', de: 'tomas', estado: 'pendiente', haceDias: 2 },
  { grupo: 'gravel', a: 'lucia', de: 'valentina', estado: 'pendiente', haceDias: 1, grupoOrigen: 'pedal' },
  // Las que mandó ella como líder.
  { grupo: 'moteros', a: 'tomas', de: 'lucia', estado: 'pendiente', haceDias: 3 },
  { grupo: 'moteros', a: 'ezequiel', de: 'lucia', estado: 'rechazada', haceDias: 20 },
  { grupo: 'pedal', a: 'diego', de: 'lucia', estado: 'pendiente', haceDias: 5, grupoOrigen: 'trekking' },
  // Entre terceros: historial para el backoffice y los reportes.
  { grupo: 'runners', a: 'valentina', de: 'camila', estado: 'rechazada', haceDias: 60 },
  { grupo: 'runners', a: 'florencia', de: 'martin', estado: 'pendiente', haceDias: 4 },
  { grupo: 'trekking', a: 'carolina', de: 'diego', estado: 'pendiente', haceDias: 6 },
  { grupo: 'caminantes', a: 'sofia', de: 'julieta', estado: 'pendiente', haceDias: 2 },
  { grupo: 'nocturna', a: 'joaquin', de: 'facundo', estado: 'rechazada', haceDias: 30 },
  { grupo: 'gravel', a: 'agustina', de: 'valentina', estado: 'rechazada', haceDias: 45 },
]

export type AmistadDemo = { de: string; a: string; estado: 'pendiente' | 'aceptada' | 'rechazada'; haceDias: number }

export const AMISTADES: AmistadDemo[] = [
  // Amigos de la protagonista.
  { de: 'lucia', a: 'martin', estado: 'aceptada', haceDias: 290 },
  { de: 'sofia', a: 'lucia', estado: 'aceptada', haceDias: 200 },
  { de: 'lucia', a: 'diego', estado: 'aceptada', haceDias: 380 },
  { de: 'valentina', a: 'lucia', estado: 'aceptada', haceDias: 240 },
  { de: 'lucia', a: 'joaquin', estado: 'aceptada', haceDias: 310 },
  { de: 'camila', a: 'lucia', estado: 'aceptada', haceDias: 150 },
  { de: 'lucia', a: 'carolina', estado: 'aceptada', haceDias: 120 },
  { de: 'agustina', a: 'lucia', estado: 'aceptada', haceDias: 90 },
  // Solicitudes que le llegaron y no respondió.
  { de: 'nicolas', a: 'lucia', estado: 'pendiente', haceDias: 2 },
  { de: 'julieta', a: 'lucia', estado: 'pendiente', haceDias: 1 },
  { de: 'lautaro', a: 'lucia', estado: 'pendiente', haceDias: 0 },
  // Solicitudes que mandó ella.
  { de: 'lucia', a: 'micaela', estado: 'pendiente', haceDias: 3 },
  { de: 'lucia', a: 'tomas', estado: 'pendiente', haceDias: 6 },
  { de: 'bruno', a: 'lucia', estado: 'rechazada', haceDias: 40 },
  // Los otros dos usuarios con login.
  { de: 'martin', a: 'sofia', estado: 'aceptada', haceDias: 180 },
  { de: 'martin', a: 'camila', estado: 'aceptada', haceDias: 260 },
  { de: 'agustina', a: 'martin', estado: 'aceptada', haceDias: 200 },
  { de: 'rocio', a: 'martin', estado: 'pendiente', haceDias: 1 },
  { de: 'martin', a: 'paula', estado: 'pendiente', haceDias: 4 },
  { de: 'sofia', a: 'diego', estado: 'aceptada', haceDias: 190 },
  { de: 'julieta', a: 'sofia', estado: 'aceptada', haceDias: 160 },
  { de: 'antonella', a: 'sofia', estado: 'pendiente', haceDias: 2 },
  // Red entre el resto.
  { de: 'diego', a: 'julieta', estado: 'aceptada', haceDias: 190 },
  { de: 'diego', a: 'micaela', estado: 'aceptada', haceDias: 120 },
  { de: 'valentina', a: 'florencia', estado: 'aceptada', haceDias: 270 },
  { de: 'valentina', a: 'matias', estado: 'aceptada', haceDias: 170 },
  { de: 'florencia', a: 'lautaro', estado: 'aceptada', haceDias: 100 },
  { de: 'joaquin', a: 'nicolas', estado: 'aceptada', haceDias: 300 },
  { de: 'joaquin', a: 'facundo', estado: 'aceptada', haceDias: 210 },
  { de: 'nicolas', a: 'facundo', estado: 'aceptada', haceDias: 205 },
  { de: 'facundo', a: 'bruno', estado: 'aceptada', haceDias: 75 },
  { de: 'tomas', a: 'ezequiel', estado: 'aceptada', haceDias: 140 },
  { de: 'tomas', a: 'santiago', estado: 'aceptada', haceDias: 15 },
  { de: 'camila', a: 'agustina', estado: 'aceptada', haceDias: 230 },
  { de: 'camila', a: 'rocio', estado: 'aceptada', haceDias: 90 },
  { de: 'agustina', a: 'paula', estado: 'aceptada', haceDias: 25 },
  { de: 'micaela', a: 'antonella', estado: 'aceptada', haceDias: 70 },
  { de: 'matias', a: 'ignacio', estado: 'aceptada', haceDias: 40 },
  { de: 'ramiro', a: 'bruno', estado: 'rechazada', haceDias: 50 },
  { de: 'santiago', a: 'ezequiel', estado: 'pendiente', haceDias: 5 },
  { de: 'paula', a: 'carolina', estado: 'pendiente', haceDias: 7 },
  { de: 'ignacio', a: 'lautaro', estado: 'aceptada', haceDias: 35 },
]

// ── Viajes de vitrina (con traza GPS completa) ───────────────────────────────

export type ParadaGuion = { en: number; min: number; categoria: CategoriaParada }

export type AlertaGuion = {
  /** Momento del viaje, de 0 (inicio) a 1 (fin). */
  f: number
  tipo: TipoAlerta
  origen: OrigenAlerta
  /** Autor (líder o integrante) o, si es del sistema, la persona afectada. */
  por: string
  /** Texto para alertas manuales. Las del sistema arman el suyo con `metros`. */
  mensaje?: string
  metros?: number
  estado?: EstadoAlerta
}

export type SolicitudGuion = {
  f: number
  por: string
  motivo: string
  estado: 'aprobada' | 'rechazada' | 'cancelada'
}

export type GastoGuion = {
  por: string
  monto: number
  descripcion: string
  /** Entre quiénes se reparte; por defecto, todos los que fueron. */
  entre?: string[]
}

export type PublicacionGuion = {
  por: string
  comentario?: string
  /** Publica también su checklist. */
  checklist?: boolean
  /** [recomiendan, no recomiendan] de la comunidad. */
  votos: [number, number]
  /** Valoración de la protagonista; sin definir = no votó (para votar en vivo). */
  votoProtagonista?: boolean
}

export type ViajeVitrina = {
  clave: string
  nombre: string
  /** Clave de `rutas.catalogo.ts`. */
  ruta: string
  /** Si la misma ruta se hace en otra modalidad (p. ej. un camino de auto en moto). */
  actividad?: TipoActividad
  modo: ModoViaje
  haceDias: number
  /** Hora de salida, hora argentina (7.5 = 07:30). */
  hora: number
  creador: string
  /** Los que fueron además del creador. */
  integrantes: string[]
  grupo?: string
  vuelta?: boolean
  cortarEnKm?: number
  /** Cada uno a su ritmo (competitivo). */
  libre?: boolean
  ritmos?: Record<string, number>
  paradas?: ParadaGuion[]
  paradasDe?: (ParadaGuion & { quien: string; incidente?: boolean })[]
  alertas?: AlertaGuion[]
  solicitudes?: SolicitudGuion[]
  gastos?: GastoGuion[]
  /** Ítems que el líder agregó al checklist de todos. */
  checklistLider?: string[]
  sale?: { quien: string; en: number }
  /** Confirmaron pero no fueron. */
  ausentes?: string[]
  rechazaron?: string[]
  /** Fueron con el compartir ubicación apagado (RN-111). */
  noComparte?: string[]
  /** Tramo sin señal de alguien: esos puntos llegan después como `offline_sync` (RN-038). */
  sinSenal?: { quien: string; de: number; a: number }
  publicar?: PublicacionGuion
  /** Si el horario todavía no pasó el día del seed, se omite en vez de correrlo una semana. */
  opcional?: boolean
}

export const VIAJES_VITRINA: ViajeVitrina[] = [
  // ── Historia de la protagonista: una salida cada pocos días, sin semanas vacías ──
  { clave: 'trote-hoy', nombre: 'Trote matutino', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 0, hora: 7, creador: 'lucia', integrantes: [], ritmos: { lucia: 1.07 }, opcional: true },
  { clave: 'costanera-bici', nombre: 'Vuelta por la costanera', ruta: 'bici-ciudad', modo: 'recreativo', haceDias: 1, hora: 18.5, creador: 'lucia', integrantes: [] },
  { clave: 'bici-fondo', nombre: 'Fondo hasta Cuesta Blanca', ruta: 'bici-san-roque', modo: 'recreativo', haceDias: 2, hora: 7, creador: 'lucia', integrantes: [] },
  {
    clave: 'altas-cumbres',
    nombre: 'Altas Cumbres con los Moteros',
    ruta: 'altas-cumbres',
    modo: 'recreativo',
    haceDias: 4,
    hora: 9,
    creador: 'lucia',
    integrantes: ['martin', 'joaquin', 'nicolas', 'facundo', 'bruno'],
    grupo: 'moteros',
    paradas: [
      { en: 0.27, min: 12, categoria: 'combustible' },
      { en: 0.66, min: 35, categoria: 'gastronomia' },
      { en: 0.8, min: 8, categoria: 'descanso' },
    ],
    paradasDe: [
      { quien: 'facundo', en: 0.45, min: 5, categoria: 'sanitario' },
      { quien: 'bruno', en: 0.9, min: 7, categoria: 'otro', incidente: true },
    ],
    alertas: [
      { f: 0.1, tipo: 'combustible', origen: 'lider', por: 'lucia', mensaje: 'Cargamos todos en la YPF de Carlos Paz, después no hay hasta Mina Clavero' },
      { f: 0.46, tipo: 'desvio', origen: 'sistema', por: 'facundo', metros: 180 },
      { f: 0.5, tipo: 'peligro', origen: 'lider', por: 'lucia', mensaje: 'Neblina en la subida, bajen la velocidad y prendan las luces' },
      { f: 0.58, tipo: 'atraso', origen: 'sistema', por: 'facundo', metros: 1450 },
      { f: 0.74, tipo: 'informacion', origen: 'integrante', por: 'martin', mensaje: 'Animales sueltos sobre la ruta pasando el parador' },
    ],
    solicitudes: [
      { f: 0.4, por: 'facundo', motivo: 'Necesito parar un minuto', estado: 'aprobada' },
      { f: 0.85, por: 'nicolas', motivo: 'Fotos en el mirador', estado: 'rechazada' },
    ],
    gastos: [
      { por: 'lucia', monto: 84000, descripcion: 'Almuerzo en el Parador El Cóndor' },
      { por: 'martin', monto: 15600, descripcion: 'Café y medialunas en Carlos Paz' },
      { por: 'joaquin', monto: 22000, descripcion: 'Cámara de repuesto para Facundo', entre: ['facundo', 'joaquin'] },
    ],
    checklistLider: ['Chaleco reflectivo', 'Efectivo para peajes'],
    noComparte: ['nicolas'],
    sinSenal: { quien: 'joaquin', de: 0.6, a: 0.68 },
    publicar: {
      por: 'lucia',
      comentario: 'Asfalto impecable y curvas todo el camino. Cargar nafta en Carlos Paz: después no hay hasta Mina Clavero. Arriba hace frío aunque sea verano.',
      checklist: true,
      votos: [7, 1],
    },
  },
  { clave: 'run-10k', nombre: '10K por la costanera', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 8, hora: 7.5, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 1.05 } },
  {
    clave: 'quebrada',
    nombre: 'Dique La Quebrada en bici',
    ruta: 'bici-quebrada',
    modo: 'recreativo',
    haceDias: 6,
    hora: 8,
    creador: 'lucia',
    integrantes: ['sofia', 'valentina', 'florencia', 'matias'],
    grupo: 'pedal',
    paradas: [
      { en: 0.33, min: 8, categoria: 'descanso' },
      { en: 0.85, min: 20, categoria: 'gastronomia' },
    ],
    paradasDe: [{ quien: 'matias', en: 0.6, min: 6, categoria: 'otro' }],
    alertas: [
      { f: 0.25, tipo: 'parada', origen: 'lider', por: 'lucia', mensaje: 'Reagrupamos en la plaza de Villa Allende' },
      { f: 0.62, tipo: 'atraso', origen: 'sistema', por: 'matias', metros: 420 },
      { f: 0.72, tipo: 'peligro', origen: 'lider', por: 'lucia', mensaje: 'Perro suelto en la bajada', estado: 'cancelada' },
    ],
    solicitudes: [{ f: 0.55, por: 'florencia', motivo: 'Necesito cargar agua', estado: 'aprobada' }],
    gastos: [{ por: 'sofia', monto: 18500, descripcion: 'Facturas y café en Río Ceballos' }],
    checklistLider: ['Luz trasera cargada'],
    publicar: {
      por: 'sofia',
      comentario: 'Subida tendida y con poco tránsito temprano. Ideal para arrancar con salidas largas.',
      votos: [5, 0],
    },
  },
  { clave: 'run-s1', nombre: 'Rodaje suave', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 15, hora: 7.5, creador: 'lucia', integrantes: [], ritmos: { lucia: 1.03 } },
  {
    clave: 'uritorco',
    nombre: 'Cumbre del Uritorco',
    ruta: 'trek-uritorco',
    modo: 'recreativo',
    haceDias: 18,
    hora: 8,
    creador: 'diego',
    integrantes: ['lucia', 'sofia', 'julieta'],
    grupo: 'trekking',
    vuelta: true,
    paradas: [
      { en: 0.22, min: 10, categoria: 'descanso' },
      { en: 0.5, min: 40, categoria: 'gastronomia' },
      { en: 0.8, min: 10, categoria: 'descanso' },
    ],
    alertas: [
      { f: 0.42, tipo: 'peligro', origen: 'lider', por: 'diego', mensaje: 'Piedra suelta en el tramo final, pisen con cuidado' },
      { f: 0.7, tipo: 'atraso', origen: 'sistema', por: 'julieta', metros: 180 },
    ],
    solicitudes: [{ f: 0.68, por: 'julieta', motivo: 'Me molesta la rodilla, bajemos más despacio', estado: 'aprobada' }],
    gastos: [
      { por: 'diego', monto: 24000, descripcion: 'Entradas al cerro' },
      { por: 'lucia', monto: 46000, descripcion: 'Almuerzo en Capilla del Monte' },
    ],
    checklistLider: ['Bastones de trekking', 'Efectivo para la entrada'],
    sinSenal: { quien: 'lucia', de: 0.4, a: 0.52 },
    publicar: {
      por: 'lucia',
      comentario: 'Salir temprano: la subida pega fuerte desde el primer tramo y arriba no hay sombra. Llevar 2 litros de agua por persona.',
      checklist: true,
      votos: [9, 0],
    },
  },
  { clave: 'run-10k-2', nombre: 'Fondo por la costanera', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 22, hora: 7.5, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 1.01 } },
  {
    clave: 'calamuchita',
    nombre: 'Asado en Villa General Belgrano',
    ruta: 'calamuchita',
    modo: 'recreativo',
    haceDias: 25,
    hora: 9.5,
    creador: 'lucia',
    integrantes: ['martin', 'joaquin', 'nicolas', 'facundo'],
    grupo: 'moteros',
    paradas: [
      { en: 0.42, min: 10, categoria: 'combustible' },
      { en: 0.74, min: 15, categoria: 'descanso' },
    ],
    // RN-022: una parada por accidente avisa sola a todo el grupo con una alerta de peligro.
    paradasDe: [{ quien: 'nicolas', en: 0.55, min: 9, categoria: 'accidente' }],
    alertas: [{ f: 0.35, tipo: 'combustible', origen: 'lider', por: 'lucia', mensaje: 'Cargamos en la Shell de Alta Gracia' }],
    solicitudes: [{ f: 0.6, por: 'nicolas', motivo: 'Paramos a sacar fotos en el dique?', estado: 'aprobada' }],
    gastos: [
      { por: 'martin', monto: 96000, descripcion: 'Asado y bebidas' },
      { por: 'lucia', monto: 12000, descripcion: 'Carbón y pan' },
    ],
    rechazaron: ['bruno'],
    ausentes: ['ramiro'],
  },
  { clave: 'run-s2', nombre: 'Series en el parque', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 29, hora: 7.5, creador: 'lucia', integrantes: [], ritmos: { lucia: 1.0 } },
  {
    clave: 'desafio-san-roque',
    nombre: 'Desafío San Roque',
    ruta: 'bici-san-roque',
    modo: 'competitivo',
    haceDias: 32,
    hora: 7,
    creador: 'lucia',
    integrantes: ['valentina', 'florencia', 'lautaro'],
    grupo: 'pedal',
    libre: true,
    ritmos: { lucia: 1.0, valentina: 1.07, florencia: 0.95, lautaro: 0.9 },
    publicar: {
      por: 'valentina',
      comentario: 'Exigente pero muy linda. El tramo de La Calera al dique tiene banquina angosta: ir en fila.',
      votos: [6, 2],
    },
  },
  { clave: 'run-10k-3', nombre: 'Tirada larga', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 36, hora: 7.5, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 0.97 } },
  {
    clave: 'punilla',
    nombre: 'Escapada a Capilla del Monte',
    ruta: 'punilla',
    modo: 'recreativo',
    haceDias: 39,
    hora: 10,
    creador: 'lucia',
    integrantes: ['sofia', 'carolina'],
    paradas: [
      { en: 0.5, min: 10, categoria: 'combustible' },
      { en: 0.7, min: 45, categoria: 'gastronomia' },
    ],
    gastos: [
      { por: 'lucia', monto: 62000, descripcion: 'Nafta' },
      { por: 'lucia', monto: 5400, descripcion: 'Peajes' },
      { por: 'sofia', monto: 54000, descripcion: 'Almuerzo en La Falda' },
      { por: 'carolina', monto: 9000, descripcion: 'Alfajores para el regreso', entre: ['carolina', 'sofia'] },
    ],
  },
  {
    clave: 'media-suquia',
    nombre: 'Media maratón del Suquía',
    ruta: 'run-fondo',
    modo: 'competitivo',
    haceDias: 43,
    hora: 7,
    creador: 'martin',
    integrantes: ['lucia', 'camila', 'agustina', 'rocio'],
    grupo: 'runners',
    vuelta: true,
    cortarEnKm: 21.7,
    libre: true,
    ritmos: { martin: 1.08, lucia: 0.99, camila: 1.03, agustina: 1.12, rocio: 0.9 },
    checklistLider: ['Dorsal', 'Remera del grupo'],
    publicar: {
      por: 'martin',
      comentario: 'Circuito plano y rápido por la costanera. Hay bebederos en la Isla de los Patos.',
      checklist: true,
      votos: [8, 1],
    },
  },
  {
    clave: 'wank',
    nombre: 'Cerro Wank y cascada',
    ruta: 'trek-wank',
    modo: 'recreativo',
    haceDias: 46,
    hora: 9,
    creador: 'lucia',
    integrantes: ['sofia', 'micaela'],
    vuelta: true,
    paradas: [{ en: 0.5, min: 25, categoria: 'descanso' }],
    gastos: [{ por: 'micaela', monto: 13500, descripcion: 'Estacionamiento y entrada al pueblo' }],
  },
  { clave: 'run-s3', nombre: 'Rodaje regenerativo', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 50, hora: 7.5, creador: 'lucia', integrantes: [], ritmos: { lucia: 0.95 } },
  {
    clave: 'gran-fondo',
    nombre: 'Gran Fondo Sierras Chicas',
    ruta: 'bici-gran-fondo',
    modo: 'recreativo',
    haceDias: 53,
    hora: 6.5,
    creador: 'valentina',
    integrantes: ['lucia', 'matias'],
    grupo: 'pedal',
    paradas: [
      { en: 0.36, min: 15, categoria: 'descanso' },
      { en: 0.52, min: 30, categoria: 'gastronomia' },
      { en: 0.8, min: 10, categoria: 'punto_control' },
    ],
    alertas: [{ f: 0.2, tipo: 'informacion', origen: 'lider', por: 'valentina', mensaje: 'Viento en contra hasta Jesús María, vamos a rueda' }],
    gastos: [{ por: 'valentina', monto: 39000, descripcion: 'Almuerzo en Ascochinga' }],
    // La protagonista se bajó en Ascochinga: por eso todavía no tiene la insignia de 100 km.
    sale: { quien: 'lucia', en: 0.54 },
  },
  { clave: 'run-10k-4', nombre: 'Primer 10K', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 57, hora: 7.5, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 0.93 } },
  {
    clave: 'condorito',
    nombre: 'Quebrada del Condorito',
    ruta: 'trek-condorito',
    modo: 'recreativo',
    haceDias: 60,
    hora: 8.5,
    creador: 'diego',
    integrantes: ['lucia', 'julieta', 'micaela', 'antonella'],
    grupo: 'trekking',
    vuelta: true,
    paradas: [
      { en: 0.25, min: 8, categoria: 'punto_control' },
      { en: 0.5, min: 35, categoria: 'gastronomia' },
    ],
    gastos: [{ por: 'diego', monto: 30000, descripcion: 'Nafta del viaje hasta La Pampilla' }],
    checklistLider: ['Binoculares'],
    publicar: {
      por: 'diego',
      comentario: 'Sendero muy bien marcado. En el Balcón Norte se ven cóndores casi siempre antes del mediodía.',
      checklist: true,
      votos: [11, 1],
      votoProtagonista: true,
    },
  },
  { clave: 'run-s4', nombre: 'Vuelta al parque', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 64, hora: 7.5, creador: 'lucia', integrantes: [], cortarEnKm: 4, ritmos: { lucia: 0.91 } },
  {
    clave: 'cumbrecita',
    nombre: 'Rodada a La Cumbrecita',
    ruta: 'cumbrecita',
    modo: 'recreativo',
    haceDias: 67,
    hora: 10,
    creador: 'lucia',
    integrantes: ['joaquin', 'nicolas', 'facundo'],
    grupo: 'moteros',
    paradas: [{ en: 0.55, min: 10, categoria: 'descanso' }],
    gastos: [{ por: 'joaquin', monto: 48000, descripcion: 'Merienda en La Cumbrecita' }],
  },
  // Las dos primeras salidas fueron más cortas: en el circuito se ve cómo fue sumando distancia.
  { clave: 'run-s5', nombre: 'Arranco a correr', ruta: 'run-sarmiento', modo: 'entrenamiento', haceDias: 71, hora: 7.5, creador: 'lucia', integrantes: [], cortarEnKm: 3, ritmos: { lucia: 0.88 } },
  // Antes de la racha actual: salidas sueltas.
  { clave: 'bici-paseo', nombre: 'Paseo en bici', ruta: 'bici-ciudad', modo: 'recreativo', haceDias: 96, hora: 17, creador: 'lucia', integrantes: [] },
  {
    clave: 'sierras-chicas',
    nombre: 'Paseo a Ascochinga',
    ruta: 'sierras-chicas',
    modo: 'recreativo',
    haceDias: 131,
    hora: 10.5,
    creador: 'lucia',
    integrantes: ['martin', 'sofia'],
    paradas: [
      { en: 0.4, min: 8, categoria: 'combustible' },
      { en: 0.85, min: 50, categoria: 'gastronomia' },
    ],
    gastos: [
      { por: 'lucia', monto: 31000, descripcion: 'Nafta' },
      { por: 'martin', monto: 57000, descripcion: 'Parrilla en La Granja' },
    ],
  },

  // ── Tab Entrenar (RN-066): lo que alimenta circuitos y sesiones además de los trotes de arriba ──
  // Bici: cuatro salidas desde la misma ruta guardada ("Ciclovía del Suquía"), cada vez más largas.
  { clave: 'bici-e1', nombre: 'Ciclovía suave', ruta: 'bici-ciudad', modo: 'entrenamiento', haceDias: 45, hora: 18, creador: 'lucia', integrantes: [], vuelta: true, cortarEnKm: 19, ritmos: { lucia: 0.92 } },
  { clave: 'bici-e2', nombre: 'Ciclovía a ritmo', ruta: 'bici-ciudad', modo: 'entrenamiento', haceDias: 27, hora: 18, creador: 'lucia', integrantes: [], vuelta: true, cortarEnKm: 24, ritmos: { lucia: 0.97 } },
  { clave: 'bici-e3', nombre: 'Cambios de ritmo en la ciclovía', ruta: 'bici-ciudad', modo: 'entrenamiento', haceDias: 11, hora: 18, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 1.02 } },
  { clave: 'bici-e4', nombre: 'Ciclovía contrarreloj', ruta: 'bici-ciudad', modo: 'entrenamiento', haceDias: 3, hora: 18.5, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 1.05 } },
  // Sesiones sueltas: sin circuito, para mostrar "Repetir" armando uno en vivo.
  { clave: 'run-fondo-suelto', nombre: 'Fondo largo al Kempes', ruta: 'run-fondo', modo: 'entrenamiento', haceDias: 12, hora: 8, creador: 'lucia', integrantes: [], ritmos: { lucia: 0.98 } },
  { clave: 'otro-caminata', nombre: 'Caminata rápida por el parque', ruta: 'run-sarmiento', actividad: 'otro', modo: 'entrenamiento', haceDias: 9, hora: 19, creador: 'lucia', integrantes: [] },
  // Entrenamiento grupal que armó Martín: a Lucía le queda como sesión "armada por otra persona".
  { clave: 'martin-p1', nombre: 'Progresivos por la costanera', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 30, hora: 19, creador: 'martin', integrantes: [], ritmos: { martin: 1.04 } },
  {
    clave: 'runners-progresivos',
    nombre: 'Progresivos con los Runners',
    ruta: 'run-costanera',
    modo: 'entrenamiento',
    haceDias: 16,
    hora: 19.5,
    creador: 'martin',
    integrantes: ['lucia', 'camila', 'agustina'],
    grupo: 'runners',
    libre: true,
    ritmos: { martin: 1.1, lucia: 1.02, camila: 1.05, agustina: 1.12 },
    checklistLider: ['Luz frontal'],
  },
  { clave: 'martin-p3', nombre: 'Progresivos en solitario', ruta: 'run-costanera', modo: 'entrenamiento', haceDias: 5, hora: 19, creador: 'martin', integrantes: [], ritmos: { martin: 1.09 } },
  // Trekking: Sofía entrena en el Cerro Wank; Lucía fue una vez invitada y después lo repitió sola,
  // así que cada una tiene su propio circuito sobre el mismo recorrido.
  { clave: 'sofia-w1', nombre: 'Subida al Cerro Wank', ruta: 'trek-wank', modo: 'entrenamiento', haceDias: 52, hora: 9, creador: 'sofia', integrantes: [], vuelta: true, ritmos: { sofia: 0.95 } },
  { clave: 'wank-grupal', nombre: 'Cerro Wank a ritmo', ruta: 'trek-wank', modo: 'entrenamiento', haceDias: 34, hora: 9, creador: 'sofia', integrantes: ['lucia'], vuelta: true, ritmos: { sofia: 1.02 } },
  // Reciente a propósito: el ranking mensual es por mes calendario y así figura también en trekking.
  { clave: 'lucia-w2', nombre: 'Cerro Wank sin pausas', ruta: 'trek-wank', modo: 'entrenamiento', haceDias: 5, hora: 9, creador: 'lucia', integrantes: [], vuelta: true, ritmos: { lucia: 1.07 } },
  { clave: 'sofia-w3', nombre: 'Cerro Wank contra el reloj', ruta: 'trek-wank', modo: 'entrenamiento', haceDias: 10, hora: 9, creador: 'sofia', integrantes: [], vuelta: true, ritmos: { sofia: 1.08 } },

  // ── Recorridos que publicó el resto de la comunidad ──
  {
    clave: 'pub-suquia',
    nombre: 'Ciclovía del Suquía, ida y vuelta',
    ruta: 'bici-ciudad',
    modo: 'recreativo',
    haceDias: 58,
    hora: 8,
    creador: 'florencia',
    integrantes: [],
    vuelta: true,
    publicar: {
      por: 'florencia',
      comentario: 'Ida y vuelta por la ciclovía sin cruzar avenidas. Los domingos temprano está casi vacía: ideal para entrenar.',
      votos: [6, 0],
      votoProtagonista: true,
    },
  },
  {
    clave: 'pub-costanera',
    nombre: 'Costanera al amanecer',
    ruta: 'run-costanera',
    modo: 'entrenamiento',
    haceDias: 6,
    hora: 6.5,
    creador: 'agustina',
    integrantes: [],
    vuelta: true,
    ritmos: { agustina: 1.1 },
    publicar: {
      por: 'agustina',
      comentario: 'Ida y vuelta de 12K sin cruzar avenidas. Bien iluminado hasta la Isla de los Patos.',
      checklist: true,
      votos: [10, 0],
    },
  },
  {
    clave: 'pub-ciclovia',
    nombre: 'Ciclovía hasta el Parque de las Naciones',
    ruta: 'bici-ciudad',
    modo: 'recreativo',
    haceDias: 3,
    hora: 18,
    creador: 'ignacio',
    integrantes: [],
    publicar: { por: 'ignacio', votos: [0, 0] },
  },
  {
    clave: 'pub-wank',
    nombre: 'Cerro Wank para principiantes',
    ruta: 'trek-wank',
    modo: 'recreativo',
    haceDias: 13,
    hora: 10,
    creador: 'micaela',
    integrantes: [],
    vuelta: true,
    publicar: {
      por: 'micaela',
      comentario: 'Corto y con vista a todo el valle. Se puede hacer con chicos.',
      votos: [2, 0],
    },
  },
  {
    clave: 'pub-punilla',
    nombre: 'Punilla en moto hasta Capilla',
    ruta: 'punilla',
    actividad: 'moto',
    modo: 'recreativo',
    haceDias: 20,
    hora: 9,
    creador: 'joaquin',
    integrantes: [],
    publicar: {
      por: 'joaquin',
      comentario: 'La ruta 38 se carga mucho los domingos a la tarde: conviene volver antes de las 17.',
      votos: [4, 3],
    },
  },
  {
    clave: 'pub-sierras',
    nombre: 'Sierras Chicas en auto',
    ruta: 'sierras-chicas',
    modo: 'recreativo',
    haceDias: 27,
    hora: 11,
    creador: 'tomas',
    integrantes: [],
    publicar: {
      por: 'tomas',
      comentario: 'Mucho lomo de burro entre Villa Allende y Río Ceballos. Lindo paseo, pero lento.',
      votos: [1, 2],
      votoProtagonista: false,
    },
  },
  {
    clave: 'pub-cumbrecita',
    nombre: 'La Cumbrecita por Athos Pampa',
    ruta: 'cumbrecita',
    modo: 'recreativo',
    haceDias: 34,
    hora: 9.5,
    creador: 'nicolas',
    integrantes: [],
    publicar: {
      por: 'nicolas',
      comentario: 'Camino de montaña con curvas cerradas y mirador a mitad de recorrido. El pueblo es peatonal: se deja la moto en la entrada.',
      votos: [3, 0],
      votoProtagonista: true,
    },
  },
]

/** Recorridos publicados que la protagonista guardó en "Mis rutas" (RN-084). */
export const RUTAS_GUARDADAS: { viaje: string; conChecklist?: boolean; haceDias: number }[] = [
  { viaje: 'pub-cumbrecita', haceDias: 9 },
  { viaje: 'pub-costanera', conChecklist: true, haceDias: 5 },
  { viaje: 'condorito', conChecklist: true, haceDias: 30 },
  // De esta ruta salen sus entrenamientos en bici: forman un circuito (ver CIRCUITOS).
  { viaje: 'pub-suquia', haceDias: 49 },
]

// ── Circuitos de entrenamiento ───────────────────────────────────────────────

/**
 * RN-066: circuitos de la tab Entrenar. Cada uno agrupa sesiones de entrenamiento de una
 * persona sobre el mismo recorrido. Se arman de las dos maneras que tiene la app: con
 * "Repetir" (por defecto) o saliendo varias veces desde la misma ruta guardada (`plantilla`).
 *
 * Las sesiones de entrenamiento que no figuran en ningún circuito quedan sueltas en la
 * pestaña Sesiones, con su botón "Repetir".
 */
export type CircuitoDemo = {
  nombre: string
  /** Dueño del circuito: tiene que haber participado de todas las sesiones. */
  de: string
  /**
   * Claves de `VIAJES_VITRINA` en modo entrenamiento, de la más vieja a la más nueva.
   * Puede incluir una sesión que armó otra persona (un entrenamiento grupal).
   */
  sesiones: string[]
  /**
   * Clave de `RUTAS_GUARDADAS.viaje`: el circuito sale de esa ruta guardada en lugar de
   * "Repetir". Solo para la protagonista, que es quien tiene rutas guardadas.
   */
  plantilla?: string
  /**
   * Clave de `VIAJES_PLANIFICADOS` del dueño que ya está sumado al circuito. Si el
   * circuito es de "Repetir", ese viaje repite la última sesión: al iniciarlo, el
   * fantasma de esa sesión aparece solo en el mapa.
   */
  proximaSesion?: string
}

export const CIRCUITOS: CircuitoDemo[] = [
  {
    nombre: 'Vuelta al parque',
    de: 'lucia',
    sesiones: ['run-s5', 'run-s4', 'run-s3', 'run-s2', 'run-s1', 'trote-hoy'],
  },
  {
    nombre: '10K costanera',
    de: 'lucia',
    sesiones: ['run-10k-4', 'run-10k-3', 'run-10k-2', 'run-10k'],
    proximaSesion: 'plan-run',
  },
  {
    nombre: 'Ciclovía del Suquía, ida y vuelta',
    de: 'lucia',
    sesiones: ['bici-e1', 'bici-e2', 'bici-e3', 'bici-e4'],
    plantilla: 'pub-suquia',
    proximaSesion: 'plan-ciclovia',
  },
  // El circuito de una invitada nace cuando repite ella: arranca con la sesión grupal de Sofía.
  { nombre: 'Cerro Wank a ritmo', de: 'lucia', sesiones: ['wank-grupal', 'lucia-w2'] },
  // Los otros dos usuarios con login también tienen qué mostrar en Entrenar.
  { nombre: 'Cerro Wank a ritmo', de: 'sofia', sesiones: ['sofia-w1', 'wank-grupal', 'sofia-w3'] },
  { nombre: 'Progresivos por la costanera', de: 'martin', sesiones: ['martin-p1', 'runners-progresivos', 'martin-p3'] },
]

// ── Viajes planificados ──────────────────────────────────────────────────────

export type ViajePlanificado = {
  clave: string
  nombre: string
  /** Sin ruta: viaje recién creado, falta configurarla. */
  ruta?: string
  actividad?: TipoActividad
  modo: ModoViaje
  enDias: number
  hora: number
  creador: string
  grupo?: string
  confirmados?: string[]
  pendientes?: string[]
  rechazados?: string[]
  checklistLider?: string[]
  /** Genera el link para compartir la ruta (RN-085). */
  compartirRuta?: boolean
  /** Con el link de este viaje la protagonista guarda la ruta en "Mis rutas". */
  protagonistaGuardaRuta?: boolean
}

export const VIAJES_PLANIFICADOS: ViajePlanificado[] = [
  { clave: 'plan-run', nombre: 'Entrenamiento en la costanera', ruta: 'run-costanera', modo: 'entrenamiento', enDias: 1, hora: 7, creador: 'lucia' },
  {
    clave: 'plan-trote',
    nombre: 'Trote nocturno del grupo',
    ruta: 'run-sarmiento',
    modo: 'entrenamiento',
    enDias: 2,
    hora: 19.5,
    creador: 'martin',
    grupo: 'runners',
    confirmados: ['lucia', 'camila', 'agustina'],
    pendientes: ['rocio', 'paula', 'carolina', 'sofia'],
    checklistLider: ['Luz frontal', 'Remera del grupo'],
  },
  // Invitación a un entrenamiento sin responder: prende la campanita de la tab Entrenar.
  {
    clave: 'plan-pasadas',
    nombre: 'Pasadas de 1000 en el parque',
    ruta: 'run-sarmiento',
    modo: 'entrenamiento',
    enDias: 3,
    hora: 19,
    creador: 'camila',
    grupo: 'runners',
    confirmados: ['agustina', 'rocio'],
    pendientes: ['lucia', 'martin', 'paula'],
    checklistLider: ['Reloj para tomar los parciales'],
  },
  // Entrenamiento grupal que arma la protagonista desde su ruta guardada: ya cuenta para el circuito.
  {
    clave: 'plan-ciclovia',
    nombre: 'Ciclovía del Suquía en grupo',
    ruta: 'bici-ciudad',
    modo: 'entrenamiento',
    enDias: 5,
    hora: 8,
    creador: 'lucia',
    grupo: 'pedal',
    confirmados: ['valentina'],
    pendientes: ['sofia', 'florencia', 'matias'],
  },
  {
    clave: 'plan-calamuchita',
    nombre: 'Vuelta a Calamuchita',
    ruta: 'calamuchita',
    modo: 'recreativo',
    enDias: 4,
    hora: 9,
    creador: 'lucia',
    grupo: 'moteros',
    confirmados: ['martin', 'joaquin', 'facundo'],
    pendientes: ['nicolas', 'bruno'],
    checklistLider: ['Chaleco reflectivo', 'Efectivo para peajes'],
    compartirRuta: true,
  },
  {
    clave: 'plan-desafio',
    nombre: 'Desafío Dique La Quebrada',
    ruta: 'bici-quebrada',
    modo: 'competitivo',
    enDias: 6,
    hora: 8,
    creador: 'lucia',
    grupo: 'pedal',
    confirmados: ['valentina', 'sofia'],
    pendientes: ['florencia', 'matias', 'lautaro', 'ignacio'],
  },
  {
    clave: 'plan-condorito',
    nombre: 'Trekking al Condorito',
    ruta: 'trek-condorito',
    modo: 'recreativo',
    enDias: 9,
    hora: 8,
    creador: 'diego',
    grupo: 'trekking',
    confirmados: ['julieta', 'micaela'],
    pendientes: ['lucia', 'sofia', 'antonella'],
    checklistLider: ['Binoculares', 'Abrigo: arriba hay viento'],
  },
  {
    clave: 'plan-sin-ruta',
    nombre: 'Próxima salida del grupo',
    actividad: 'moto',
    modo: 'recreativo',
    enDias: 16,
    hora: 9,
    creador: 'lucia',
    grupo: 'moteros',
    pendientes: ['martin', 'joaquin', 'nicolas', 'facundo', 'bruno'],
  },
  // De terceros: aparecen en el backoffice y uno le presta la ruta a la protagonista.
  {
    clave: 'plan-punilla',
    nombre: 'Encuentro de clásicos en Capilla',
    ruta: 'punilla',
    modo: 'recreativo',
    enDias: 5,
    hora: 9.5,
    creador: 'tomas',
    grupo: 'clasicos',
    confirmados: ['ezequiel', 'santiago'],
    pendientes: ['nicolas', 'joaquin'],
    compartirRuta: true,
    protagonistaGuardaRuta: true,
  },
  {
    clave: 'plan-gravel',
    nombre: 'Gravel hasta Cuesta Blanca',
    ruta: 'bici-san-roque',
    modo: 'recreativo',
    enDias: 7,
    hora: 7.5,
    creador: 'valentina',
    grupo: 'gravel',
    confirmados: ['florencia', 'lautaro'],
    pendientes: ['matias', 'ignacio', 'diego'],
  },
  { clave: 'plan-uritorco', nombre: 'Uritorco al amanecer', ruta: 'trek-uritorco', modo: 'recreativo', enDias: 12, hora: 6, creador: 'julieta', grupo: 'caminantes', confirmados: ['micaela'], pendientes: ['antonella', 'diego', 'carolina'] },
]

// ── Viajes de relleno (sin traza GPS) ────────────────────────────────────────

/**
 * Viajes finalizados entre el resto de los usuarios, repartidos en `RELLENO.dias`.
 * No tienen traza: solo alimentan rankings, rachas, insignias y la reportería del
 * backoffice. Los tres usuarios con login nunca participan, para que todo viaje que
 * puedan abrir desde la app tenga su recorrido en el mapa.
 */
export const RELLENO = { cantidad: 150, dias: 240, semilla: 20261 }

/** Qué rutas del catálogo usa el relleno para cada actividad, y si son ida y vuelta. */
export const RUTAS_POR_ACTIVIDAD: Record<TipoActividad, { ruta: string; vuelta?: boolean; peso: number }[]> = {
  moto: [
    { ruta: 'altas-cumbres', peso: 3 },
    { ruta: 'calamuchita', peso: 3 },
    { ruta: 'cumbrecita', peso: 2 },
    { ruta: 'punilla', peso: 2 },
    { ruta: 'sierras-chicas', peso: 1 },
  ],
  auto: [
    { ruta: 'punilla', peso: 3 },
    { ruta: 'sierras-chicas', peso: 3 },
    { ruta: 'calamuchita', peso: 2 },
    { ruta: 'altas-cumbres', peso: 1 },
  ],
  bici: [
    { ruta: 'bici-quebrada', peso: 4 },
    { ruta: 'bici-ciudad', peso: 6 },
    { ruta: 'bici-san-roque', peso: 1 },
    { ruta: 'bici-gran-fondo', peso: 0.4 },
  ],
  running: [
    { ruta: 'run-sarmiento', peso: 4 },
    { ruta: 'run-costanera', vuelta: true, peso: 4 },
    { ruta: 'run-fondo', peso: 2 },
    { ruta: 'run-fondo', vuelta: true, peso: 1 },
  ],
  trekking: [
    { ruta: 'trek-wank', vuelta: true, peso: 3 },
    { ruta: 'trek-condorito', vuelta: true, peso: 3 },
    { ruta: 'trek-uritorco', vuelta: true, peso: 2 },
  ],
  otro: [{ ruta: 'bici-ciudad', peso: 1 }],
}

export const GASTOS_RELLENO: Record<'motor' | 'resto', string[]> = {
  motor: ['Nafta', 'Peajes', 'Almuerzo en ruta', 'Estacionamiento', 'Café en la estación de servicio', 'Asado'],
  resto: ['Merienda', 'Agua y barritas', 'Entradas', 'Almuerzo', 'Remis de vuelta', 'Fruta para el camino'],
}

export const MOTIVOS_SOLICITUD = [
  'Necesito ir al baño',
  'Paramos a cargar agua?',
  'Se me aflojó algo, un minuto',
  'Fotos en el mirador',
  'Estoy cansado, cinco minutos',
  'Tengo que atender una llamada',
]

export const MENSAJES_ALERTA: { tipo: TipoAlerta; mensaje: string }[] = [
  { tipo: 'parada', mensaje: 'Paramos en la próxima estación' },
  { tipo: 'combustible', mensaje: 'Última estación de servicio antes de la subida' },
  { tipo: 'peligro', mensaje: 'Ripio suelto en la curva' },
  { tipo: 'peligro', mensaje: 'Animales sobre la ruta' },
  { tipo: 'informacion', mensaje: 'Reagrupamos en el próximo cruce' },
  { tipo: 'informacion', mensaje: 'Bajamos el ritmo, viene viento en contra' },
  { tipo: 'desvio', mensaje: 'Corte por obras, seguimos por el desvío señalizado' },
]
