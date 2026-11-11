/**
 * Catálogo de rutas reales de Córdoba y las sierras que usa el seed de demo.
 *
 * Acá solo van los puntos de paso: la geometría la calcula `generar-rutas.ts` con un
 * motor de ruteo y queda congelada en `rutas.geometria.json`, así el seed no depende
 * de ningún servicio externo el día de la presentación.
 */
import type { CategoriaParada, TipoActividad } from '@prisma/client'

export type PuntoNombrado = { nombre: string; lat: number; lng: number }

export type ParadaCatalogo = {
  nombre: string
  categoria: CategoriaParada
  /** Posición sobre el trazado, de 0 (origen) a 1 (destino). */
  fraccion: number
}

/** Forma del perfil de altura: no hay datos de elevación reales, se sintetiza uno creíble. */
export type PerfilAltura = {
  forma: 'llano' | 'subida' | 'paso'
  /** Metros sobre el nivel del mar en el origen. */
  base: number
  /** Punto más alto del trazado. */
  pico: number
}

export type RutaCatalogo = {
  clave: string
  actividad: TipoActividad
  /** Perfil de ruteo de Valhalla. */
  perfil: 'auto' | 'bicycle' | 'pedestrian'
  origen: PuntoNombrado
  destino: PuntoNombrado
  via?: { lat: number; lng: number }[]
  paradas: ParadaCatalogo[]
  altura: PerfilAltura
}

const PLAZA_ESPANA = { nombre: 'Plaza España, Córdoba', lat: -31.42856, lng: -64.18488 }
const PARQUE_SARMIENTO = { nombre: 'Parque Sarmiento, Córdoba', lat: -31.42951, lng: -64.17674 }
const KEMPES = { nombre: 'Parque del Kempes, Córdoba', lat: -31.3686, lng: -64.24258 }
const NACIONES = { nombre: 'Parque de las Naciones, Córdoba', lat: -31.38379, lng: -64.22759 }
const LAS_HERAS = { nombre: 'Parque Las Heras, Córdoba', lat: -31.40556, lng: -64.18476 }
const ISLA_PATOS = { lat: -31.40169, lng: -64.20427 }
const SAGRADA_FAMILIA = { lat: -31.39113, lng: -64.23284 }
const CARLOS_PAZ = { lat: -31.41838, lng: -64.4937 }
const VILLA_ALLENDE = { lat: -31.29362, lng: -64.29762 }
const RIO_CEBALLOS = { lat: -31.17091, lng: -64.3161 }
const SALSIPUEDES = { lat: -31.13641, lng: -64.29657 }
const LA_GRANJA = { lat: -31.00822, lng: -64.26835 }
const VGB = { nombre: 'Villa General Belgrano', lat: -31.97649, lng: -64.55902 }

export const RUTAS: RutaCatalogo[] = [
  // ── Moto y auto ────────────────────────────────────────────────────────────
  {
    clave: 'altas-cumbres',
    actividad: 'moto',
    perfil: 'auto',
    origen: PLAZA_ESPANA,
    destino: { nombre: 'Mina Clavero', lat: -31.72095, lng: -65.00388 },
    via: [CARLOS_PAZ, { lat: -31.60943, lng: -64.75832 }],
    paradas: [
      { nombre: 'YPF Villa Carlos Paz', categoria: 'combustible', fraccion: 0.27 },
      { nombre: 'Parador El Cóndor', categoria: 'gastronomia', fraccion: 0.66 },
      { nombre: 'Mirador Altas Cumbres', categoria: 'descanso', fraccion: 0.8 },
    ],
    altura: { forma: 'paso', base: 400, pico: 2200 },
  },
  {
    clave: 'calamuchita',
    actividad: 'moto',
    perfil: 'auto',
    origen: PLAZA_ESPANA,
    destino: VGB,
    via: [
      { lat: -31.65789, lng: -64.43386 },
      { lat: -31.81873, lng: -64.50253 },
    ],
    paradas: [
      { nombre: 'Shell Alta Gracia', categoria: 'combustible', fraccion: 0.42 },
      { nombre: 'Paredón Dique Los Molinos', categoria: 'descanso', fraccion: 0.74 },
    ],
    altura: { forma: 'subida', base: 400, pico: 820 },
  },
  {
    clave: 'cumbrecita',
    actividad: 'moto',
    perfil: 'auto',
    origen: VGB,
    destino: { nombre: 'La Cumbrecita', lat: -31.90049, lng: -64.77293 },
    paradas: [{ nombre: 'Mirador Athos Pampa', categoria: 'descanso', fraccion: 0.55 }],
    altura: { forma: 'subida', base: 820, pico: 1450 },
  },
  {
    clave: 'punilla',
    actividad: 'auto',
    perfil: 'auto',
    origen: PLAZA_ESPANA,
    destino: { nombre: 'Capilla del Monte', lat: -30.85721, lng: -64.52632 },
    via: [CARLOS_PAZ, { lat: -31.24365, lng: -64.46574 }, { lat: -31.09462, lng: -64.48294 }],
    paradas: [
      { nombre: 'Axion Cosquín', categoria: 'combustible', fraccion: 0.5 },
      { nombre: 'Confitería en La Falda', categoria: 'gastronomia', fraccion: 0.7 },
      { nombre: 'Baños públicos La Cumbre', categoria: 'sanitario', fraccion: 0.84 },
    ],
    altura: { forma: 'subida', base: 400, pico: 1100 },
  },
  {
    clave: 'sierras-chicas',
    actividad: 'auto',
    perfil: 'auto',
    origen: KEMPES,
    destino: { nombre: 'Ascochinga', lat: -30.9591, lng: -64.27257 },
    via: [VILLA_ALLENDE, RIO_CEBALLOS, SALSIPUEDES, LA_GRANJA],
    paradas: [
      { nombre: 'YPF Río Ceballos', categoria: 'combustible', fraccion: 0.4 },
      { nombre: 'Parrilla en La Granja', categoria: 'gastronomia', fraccion: 0.85 },
    ],
    altura: { forma: 'subida', base: 420, pico: 720 },
  },

  // ── Bici ───────────────────────────────────────────────────────────────────
  {
    clave: 'bici-quebrada',
    actividad: 'bici',
    perfil: 'bicycle',
    origen: NACIONES,
    destino: { nombre: 'Dique La Quebrada', lat: -31.1495, lng: -64.34564 },
    via: [VILLA_ALLENDE, RIO_CEBALLOS],
    paradas: [
      { nombre: 'Plaza de Villa Allende', categoria: 'descanso', fraccion: 0.33 },
      { nombre: 'Panadería en Río Ceballos', categoria: 'gastronomia', fraccion: 0.85 },
    ],
    altura: { forma: 'subida', base: 420, pico: 780 },
  },
  {
    clave: 'bici-san-roque',
    actividad: 'bici',
    perfil: 'bicycle',
    origen: PARQUE_SARMIENTO,
    destino: { nombre: 'Cuesta Blanca', lat: -31.47977, lng: -64.57801 },
    via: [KEMPES, { lat: -31.34915, lng: -64.33875 }, { lat: -31.37331, lng: -64.43215 }, CARLOS_PAZ],
    paradas: [
      { nombre: 'Plaza de La Calera', categoria: 'descanso', fraccion: 0.36 },
      { nombre: 'Paredón Dique San Roque', categoria: 'punto_control', fraccion: 0.58 },
      { nombre: 'Costanera de Carlos Paz', categoria: 'gastronomia', fraccion: 0.78 },
    ],
    altura: { forma: 'subida', base: 400, pico: 760 },
  },
  {
    clave: 'bici-gran-fondo',
    actividad: 'bici',
    perfil: 'bicycle',
    origen: KEMPES,
    destino: NACIONES,
    via: [
      { lat: -30.97641, lng: -64.09571 },
      { lat: -30.9591, lng: -64.27257 },
      LA_GRANJA,
      SALSIPUEDES,
      RIO_CEBALLOS,
      VILLA_ALLENDE,
    ],
    paradas: [
      { nombre: 'Estación de servicio Jesús María', categoria: 'descanso', fraccion: 0.36 },
      { nombre: 'Almacén de Ascochinga', categoria: 'gastronomia', fraccion: 0.52 },
      { nombre: 'Plaza de Río Ceballos', categoria: 'punto_control', fraccion: 0.8 },
    ],
    altura: { forma: 'paso', base: 420, pico: 760 },
  },
  {
    clave: 'bici-ciudad',
    actividad: 'bici',
    perfil: 'bicycle',
    origen: PARQUE_SARMIENTO,
    destino: NACIONES,
    via: [{ lat: -31.40627, lng: -64.18307 }, ISLA_PATOS],
    paradas: [{ nombre: 'Isla de los Patos', categoria: 'descanso', fraccion: 0.55 }],
    altura: { forma: 'llano', base: 390, pico: 430 },
  },

  // ── Running ────────────────────────────────────────────────────────────────
  {
    clave: 'run-sarmiento',
    actividad: 'running',
    perfil: 'pedestrian',
    origen: PLAZA_ESPANA,
    destino: PLAZA_ESPANA,
    via: [
      { lat: -31.4335, lng: -64.18 },
      { lat: -31.4318, lng: -64.17 },
      { lat: -31.4262, lng: -64.173 },
    ],
    paradas: [],
    altura: { forma: 'llano', base: 410, pico: 440 },
  },
  {
    clave: 'run-costanera',
    actividad: 'running',
    perfil: 'pedestrian',
    origen: LAS_HERAS,
    destino: { nombre: 'Puente Sagrada Familia, Córdoba', ...SAGRADA_FAMILIA },
    via: [ISLA_PATOS],
    paradas: [{ nombre: 'Bebedero Isla de los Patos', categoria: 'descanso', fraccion: 0.45 }],
    altura: { forma: 'llano', base: 385, pico: 410 },
  },
  {
    clave: 'run-fondo',
    actividad: 'running',
    perfil: 'pedestrian',
    origen: PARQUE_SARMIENTO,
    destino: KEMPES,
    via: [{ lat: LAS_HERAS.lat, lng: LAS_HERAS.lng }, ISLA_PATOS, SAGRADA_FAMILIA],
    paradas: [
      { nombre: 'Puesto de hidratación Isla de los Patos', categoria: 'punto_control', fraccion: 0.45 },
      { nombre: 'Puesto de hidratación Sagrada Familia', categoria: 'punto_control', fraccion: 0.75 },
    ],
    altura: { forma: 'llano', base: 385, pico: 440 },
  },

  // ── Trekking ───────────────────────────────────────────────────────────────
  {
    clave: 'trek-uritorco',
    actividad: 'trekking',
    perfil: 'pedestrian',
    origen: { nombre: 'Base del Cerro Uritorco', lat: -30.852, lng: -64.501 },
    destino: { nombre: 'Cumbre del Cerro Uritorco', lat: -30.84526, lng: -64.47702 },
    paradas: [
      { nombre: 'Puesto Valle de los Espíritus', categoria: 'punto_control', fraccion: 0.45 },
      { nombre: 'Pampilla', categoria: 'descanso', fraccion: 0.75 },
    ],
    altura: { forma: 'subida', base: 1050, pico: 1949 },
  },
  {
    clave: 'trek-condorito',
    actividad: 'trekking',
    perfil: 'pedestrian',
    origen: { nombre: 'La Pampilla, PN Quebrada del Condorito', lat: -31.6187, lng: -64.7106 },
    destino: { nombre: 'Balcón Norte, Quebrada del Condorito', lat: -31.6731, lng: -64.6943 },
    paradas: [
      { nombre: 'Centro de visitantes', categoria: 'punto_control', fraccion: 0.25 },
      { nombre: 'Mirador intermedio', categoria: 'descanso', fraccion: 0.7 },
    ],
    altura: { forma: 'paso', base: 2150, pico: 2250 },
  },
  {
    clave: 'trek-wank',
    actividad: 'trekking',
    perfil: 'pedestrian',
    origen: { nombre: 'La Cumbrecita', lat: -31.90049, lng: -64.77293 },
    destino: { nombre: 'Cerro Wank', lat: -31.88668, lng: -64.7783 },
    paradas: [{ nombre: 'Cascada Grande', categoria: 'descanso', fraccion: 0.5 }],
    altura: { forma: 'subida', base: 1450, pico: 1715 },
  },
]
