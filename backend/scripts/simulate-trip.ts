/**
 * simulate-trip.ts — Simulador de participantes GPS para Mesh.
 *
 * Herramienta de DESARROLLO. Emula uno o varios participantes recorriendo una ruta
 * real para validar el mapa en vivo y el motor de eventos (RN-034/035/036) sin salir
 * a la calle. No forma parte del build: `tsconfig.json` tiene `rootDir: ./src`, así
 * que este archivo nunca entra a `dist/`.
 *
 *   npm run simulate -- --scenario scripts/scenarios/trote-5km.json --full --speed 10
 *
 * Contratos que respeta (ver backend/docs/websockets.md):
 *   - Evento de ping:  `viaje:gps_ping`  { viajeId, lat, lng, accuracy?, recordedAt, source? }
 *   - Room:            `viaje:<uuid>`, autorizada por assertPuedeVerEnVivo
 *   - Handshake:       Firebase ID token en handshake.auth.token + header Authorization
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import 'dotenv/config'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de entorno
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ_BACKEND = path.resolve(__dirname, '..')
const DIR_CACHE = path.join(__dirname, '.cache')

/**
 * `.env.simulation` trae los uid de Firebase de prueba y la API key web.
 * Se carga DESPUÉS de `dotenv/config` (que ya leyó backend/.env con las credenciales
 * de servicio) y pisa lo que haga falta.
 */
function cargarEnvSimulacion(): void {
  const ruta = path.join(RAIZ_BACKEND, '.env.simulation')
  if (!existsSync(ruta)) return
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const idx = limpia.indexOf('=')
    if (idx < 0) continue
    const clave = limpia.slice(0, idx).trim()
    const valor = limpia.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    process.env[clave] = valor
  }
}
cargarEnvSimulacion()

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

type Transporte = 'socket' | 'rest'

type Opciones = {
  scenario: string
  speed: number
  interval: number
  apiUrl: string
  socketUrl: string
  dryRun: boolean
  viajeId: string | null
  full: boolean
  transport: Transporte
  relojReal: boolean
  ruidoM: number
  graciaSeg: number
  sinCache: boolean
}

const AYUDA = `
Simulador de participantes GPS para Mesh.

  npm run simulate -- --scenario scripts/scenarios/trote-5km.json --full --speed 10

Flags:
  --scenario <ruta>    Archivo JSON del escenario. Obligatorio.
  --speed <n>          Compresión temporal. 10 = 40 min simulados en 4 reales. Default 1.
  --interval <seg>     Segundos simulados entre pings. Default 5 (RN-031).
  --api-url <url>      Base de la API REST. Default http://localhost:3000 (SIM_API_URL).
  --socket-url <url>   Base de Socket.io. Default = --api-url (SIM_SOCKET_URL).
  --dry-run            Imprime los pings sin emitirlos ni tocar la API.
  --viaje-id <uuid>    Usa un viaje existente y ya en curso, en vez de crear uno.
  --full               Ciclo completo: crear viaje + ruta, iniciar, simular, finalizar.
  --transport <t>      socket (default) | rest. Canal por el que se mandan las posiciones.
  --real-clock         recordedAt con reloj real en vez del reloj simulado comprimido.
  --ruido <m>          Cota del ruido gaussiano en metros. Default 5.
  --grace <seg>        Segundos simulados extra tras la llegada del último. Default 300.
  --no-cache           Ignora el GeoJSON cacheado y vuelve a pedirle a OSRM.
  --help               Esta ayuda.
`.trimStart()

function parsearArgs(argv: string[]): Opciones {
  const o: Opciones = {
    scenario: '',
    speed: 1,
    interval: 5,
    apiUrl: process.env.SIM_API_URL ?? 'http://localhost:3000',
    socketUrl: process.env.SIM_SOCKET_URL ?? '',
    dryRun: false,
    viajeId: null,
    full: false,
    transport: 'socket',
    relojReal: false,
    ruidoM: 5,
    graciaSeg: 300,
    sinCache: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const sig = () => {
      const v = argv[++i]
      if (v == null) throw new Error(`Falta el valor de ${a}`)
      return v
    }
    switch (a) {
      case '--help':
      case '-h':
        console.log(AYUDA)
        process.exit(0)
        break
      case '--scenario': o.scenario = sig(); break
      case '--speed': o.speed = Number(sig()); break
      case '--interval': o.interval = Number(sig()); break
      case '--api-url': o.apiUrl = sig(); break
      case '--socket-url': o.socketUrl = sig(); break
      case '--dry-run': o.dryRun = true; break
      case '--viaje-id': o.viajeId = sig(); break
      case '--full': o.full = true; break
      case '--transport': {
        const v = sig()
        if (v !== 'socket' && v !== 'rest') throw new Error('--transport debe ser socket o rest')
        o.transport = v
        break
      }
      case '--real-clock': o.relojReal = true; break
      case '--ruido': o.ruidoM = Number(sig()); break
      case '--grace': o.graciaSeg = Number(sig()); break
      case '--no-cache': o.sinCache = true; break
      default:
        throw new Error(`Flag desconocido: ${a}. Probá --help.`)
    }
  }

  if (!o.scenario) throw new Error('Falta --scenario. Probá --help.')
  if (!Number.isFinite(o.speed) || o.speed <= 0) throw new Error('--speed debe ser > 0')
  if (!Number.isFinite(o.interval) || o.interval <= 0) throw new Error('--interval debe ser > 0')
  if (!Number.isFinite(o.ruidoM) || o.ruidoM < 0) throw new Error('--ruido debe ser >= 0')
  if (!o.full && !o.viajeId && !o.dryRun) {
    throw new Error('Sin --full hace falta --viaje-id <uuid> de un viaje ya en curso.')
  }

  o.apiUrl = o.apiUrl.replace(/\/$/, '')
  o.socketUrl = (o.socketUrl || o.apiUrl).replace(/\/$/, '')
  return o
}

// ─────────────────────────────────────────────────────────────────────────────
// Escenario
// ─────────────────────────────────────────────────────────────────────────────

const puntoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  nombre: z.string().max(200).optional(),
})

/** `trote` es el nombre coloquial; el enum TipoActividad de Prisma usa `running`. */
const ACTIVIDAD_A_TIPO = {
  trote: 'running',
  running: 'running',
  bici: 'bici',
  moto: 'moto',
  trekking: 'trekking',
} as const

type ActividadEscenario = keyof typeof ACTIVIDAD_A_TIPO

/** Espeja `perfilOsrmDesdeActividad` de frontend/lib/osrm.ts. */
const PERFIL_OSRM: Record<ActividadEscenario, string> = {
  trote: 'walking',
  running: 'walking',
  trekking: 'walking',
  bici: 'cycling',
  moto: 'driving',
}

const comportamientoSchema = z.union([
  z.literal('normal'),
  z.object({ tipo: z.literal('normal') }),
  z.object({
    tipo: z.literal('atrasado'),
    /** Multiplicador de velocidad. 0.75 = va al 75% del ritmo base. */
    factorVelocidad: z.number().gt(0).max(1).default(0.8),
    /** Si es true el factor decae linealmente de 1 al valor dado a lo largo de la ruta. */
    progresivo: z.boolean().default(false),
  }),
  z.object({
    tipo: z.literal('desvio'),
    desdeKm: z.number().min(0),
    /** Apartamiento lateral máximo respecto de la traza, en metros. */
    metros: z.number().min(1),
    /** Si vuelve a la ruta después de `largoKm`. */
    vuelve: z.boolean().default(true),
    largoKm: z.number().gt(0).default(0.5),
  }),
  z.object({
    tipo: z.literal('parada_extra'),
    atKm: z.number().min(0),
    duracionSegundos: z.number().int().positive(),
    motivo: z.string().max(200).default('parada no planificada'),
  }),
  z.object({
    tipo: z.literal('incidente'),
    atKm: z.number().min(0),
    motivo: z.string().max(200).default('se detuvo y no volvió a moverse'),
  }),
])

type Comportamiento = z.infer<typeof comportamientoSchema>

const paradaSchema = z
  .object({
    atKm: z.number().min(0).optional(),
    /** Índice 0-based dentro de `waypoints`. */
    atWaypoint: z.number().int().min(0).optional(),
    duracionSegundos: z.number().int().positive(),
    motivo: z.string().max(200).default('parada planificada'),
    // RN-022. El enum real de Prisma (CategoriaParada) tiene 7 valores.
    categoria: z
      .enum(['kiosco', 'combustible', 'descanso', 'gastronomia', 'punto_control', 'sanitario', 'otro'])
      .default('descanso'),
  })
  .refine((p) => p.atKm != null || p.atWaypoint != null, {
    message: 'Cada parada necesita atKm o atWaypoint',
  })

const escenarioSchema = z.object({
  nombre: z.string().min(1).max(100),
  actividad: z.enum(['trote', 'running', 'bici', 'moto', 'trekking']),
  esGrupal: z.boolean().optional(),
  perfilOsrm: z.string().optional(),
  origen: puntoSchema,
  destino: puntoSchema,
  waypoints: z.array(puntoSchema).default([]),
  velocidadBaseKmh: z.number().gt(0),
  paradas: z.array(paradaSchema).default([]),
  participantes: z
    .array(
      z.object({
        nombre: z.string().min(1).max(60),
        /** uid de Firebase del usuario de prueba. Resuelto a UUID interno por el backend. */
        userId: z.string().min(1),
        comportamiento: comportamientoSchema.default('normal'),
      })
    )
    .min(1),
})

type Escenario = z.infer<typeof escenarioSchema>

function cargarEscenario(ruta: string): Escenario {
  const abs = path.isAbsolute(ruta) ? ruta : path.resolve(RAIZ_BACKEND, ruta)
  if (!existsSync(abs)) throw new Error(`No existe el escenario: ${abs}`)
  const parsed = escenarioSchema.safeParse(JSON.parse(readFileSync(abs, 'utf8')))
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Escenario inválido (${abs}):\n${detalle}`)
  }
  return parsed.data
}

function tipoComportamiento(c: Comportamiento): string {
  return typeof c === 'string' ? c : c.tipo
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometría
// ─────────────────────────────────────────────────────────────────────────────

const R_TIERRA = 6_371_000
const aRad = (d: number) => (d * Math.PI) / 180
const aGrad = (r: number) => (r * 180) / Math.PI

type LatLng = { lat: number; lng: number }

function metrosEntre(a: LatLng, b: LatLng): number {
  const dLat = aRad(b.lat - a.lat)
  const dLng = aRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R_TIERRA * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Rumbo inicial de a→b en grados [0,360). */
function rumbo(a: LatLng, b: LatLng): number {
  const dLng = aRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(aRad(b.lat))
  const x =
    Math.cos(aRad(a.lat)) * Math.sin(aRad(b.lat)) -
    Math.sin(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.cos(dLng)
  return (aGrad(Math.atan2(y, x)) + 360) % 360
}

/** Desplaza un punto `distM` metros en la dirección `rumboDeg`. */
function desplazar(p: LatLng, distM: number, rumboDeg: number): LatLng {
  if (distM === 0) return p
  const br = aRad(rumboDeg)
  const dLat = (distM * Math.cos(br)) / R_TIERRA
  const dLng = (distM * Math.sin(br)) / (R_TIERRA * Math.cos(aRad(p.lat)))
  return { lat: p.lat + aGrad(dLat), lng: p.lng + aGrad(dLng) }
}

/** Ruido gaussiano por Box-Muller. `cota` se interpreta como ~2σ (95% adentro). */
function ruidoGaussiano(cotaM: number): number {
  if (cotaM <= 0) return 0
  const u1 = Math.random() || Number.EPSILON
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * (cotaM / 2)
}

/** Polilínea con distancias acumuladas, para ubicar un participante por metro recorrido. */
class Ruta {
  readonly acumM: number[] = []

  constructor(readonly puntos: LatLng[]) {
    if (puntos.length < 2) throw new Error('La ruta necesita al menos 2 puntos')
    this.acumM.push(0)
    for (let i = 1; i < puntos.length; i++) {
      this.acumM.push(this.acumM[i - 1] + metrosEntre(puntos[i - 1], puntos[i]))
    }
  }

  get largoM(): number {
    return this.acumM[this.acumM.length - 1]
  }

  /** Posición y rumbo a `distM` metros del origen, interpolando dentro del segmento. */
  en(distM: number): LatLng & { rumbo: number } {
    const d = Math.max(0, Math.min(distM, this.largoM))
    let lo = 0
    let hi = this.acumM.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (this.acumM[mid] <= d) lo = mid
      else hi = mid
    }
    const a = this.puntos[lo]
    const b = this.puntos[lo + 1] ?? this.puntos[lo]
    const tramo = this.acumM[lo + 1] - this.acumM[lo]
    const t = tramo > 0 ? (d - this.acumM[lo]) / tramo : 0
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
      rumbo: rumbo(a, b),
    }
  }

  /** Metros acumulados del vértice más cercano a `p`. Sirve para resolver `atWaypoint`. */
  distanciaDe(p: LatLng): number {
    let mejor = 0
    let mejorD = Infinity
    for (let i = 0; i < this.puntos.length; i++) {
      const d = metrosEntre(this.puntos[i], p)
      if (d < mejorD) {
        mejorD = d
        mejor = this.acumM[i]
      }
    }
    return mejor
  }

  aGeoJson(): { type: 'LineString'; coordinates: [number, number][] } {
    return { type: 'LineString', coordinates: this.puntos.map((p) => [p.lng, p.lat]) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OSRM (con caché en disco)
// ─────────────────────────────────────────────────────────────────────────────

/** Demo público de OSRM, igual que frontend/lib/osrm.ts. Sin API key, sin costo. */
const OSRM_BASE = process.env.SIM_OSRM_URL ?? 'https://router.project-osrm.org'
const OSRM_TIMEOUT_MS = 15_000

type GeoJsonLineString = { type: 'LineString'; coordinates: [number, number][] }

function claveCache(perfil: string, puntos: LatLng[]): string {
  const firma = `${perfil}|${puntos.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')}`
  return createHash('sha1').update(firma).digest('hex').slice(0, 16)
}

function leerCache(clave: string): GeoJsonLineString | null {
  const f = path.join(DIR_CACHE, `osrm-${clave}.json`)
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as GeoJsonLineString
  } catch {
    return null
  }
}

function escribirCache(clave: string, geo: GeoJsonLineString): void {
  mkdirSync(DIR_CACHE, { recursive: true })
  writeFileSync(path.join(DIR_CACHE, `osrm-${clave}.json`), JSON.stringify(geo))
}

/**
 * Interpolación lineal densificada entre waypoints. Es el plan B cuando OSRM no
 * responde: la traza no sigue calles, pero la simulación corre igual.
 */
function rutaLineal(puntos: LatLng[], pasoM = 25): GeoJsonLineString {
  const salida: [number, number][] = []
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i]
    const b = puntos[i + 1]
    const n = Math.max(1, Math.round(metrosEntre(a, b) / pasoM))
    for (let k = 0; k < n; k++) {
      const t = k / n
      salida.push([a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t])
    }
  }
  const ult = puntos[puntos.length - 1]
  salida.push([ult.lng, ult.lat])
  return { type: 'LineString', coordinates: salida }
}

async function obtenerGeometria(
  perfil: string,
  puntos: LatLng[],
  sinCache: boolean
): Promise<{ geo: GeoJsonLineString; origen: 'cache' | 'osrm' | 'lineal' }> {
  const clave = claveCache(perfil, puntos)

  if (!sinCache) {
    const cacheada = leerCache(clave)
    if (cacheada) return { geo: cacheada, origen: 'cache' }
  }

  const coords = puntos.map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${perfil}/${coords}?overview=full&geometries=geojson`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as {
      code?: string
      routes?: { geometry?: GeoJsonLineString }[]
    }
    const geo = json.routes?.[0]?.geometry
    if (!geo || geo.coordinates.length < 2) {
      throw new Error(`sin ruta transitable (code: ${json.code ?? 'desconocido'})`)
    }
    escribirCache(clave, geo)
    return { geo, origen: 'osrm' }
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e)
    console.warn(
      `⚠  OSRM no respondió (${motivo}). Caigo a interpolación lineal entre waypoints: ` +
        'la traza no va a seguir calles ni senderos.'
    )
    return { geo: rutaLineal(puntos), origen: 'lineal' }
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación Firebase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mismo mecanismo que el frontend, en dos pasos: el Admin SDK (credenciales ya
 * presentes en backend/.env) firma un custom token para el uid de prueba, y el
 * endpoint público de Identity Toolkit lo canjea por el ID token que espera
 * `socketRequireUser` / `requireUser`.
 *
 * La API key web NO es un secreto (está en frontend/lib/firebase.ts, commiteada),
 * pero igual se lee de .env.simulation para no hardcodearla acá.
 */
const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken'
/** Los ID token de Firebase duran 1 h; renovamos con margen. */
const MARGEN_RENOVACION_MS = 5 * 60 * 1000

type FirebaseAuthAdmin = { createCustomToken(uid: string): Promise<string> }

let adminAuth: FirebaseAuthAdmin | null = null

async function obtenerAdminAuth(): Promise<FirebaseAuthAdmin> {
  if (adminAuth) return adminAuth
  const faltantes = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(
    (k) => !process.env[k]
  )
  if (faltantes.length) {
    throw new Error(
      `Faltan credenciales de servicio en backend/.env: ${faltantes.join(', ')}. ` +
        'Son las mismas que usa el servidor para verificar tokens.'
    )
  }
  // Import diferido: src/config/firebase.ts inicializa el SDK al evaluarse, y para
  // entonces dotenv ya cargó backend/.env.
  const mod = (await import('../src/config/firebase')) as { firebaseAuth: FirebaseAuthAdmin }
  adminAuth = mod.firebaseAuth
  return adminAuth
}

function apiKeyWeb(): string {
  const k = process.env.FIREBASE_WEB_API_KEY?.trim()
  if (!k) {
    throw new Error(
      'Falta FIREBASE_WEB_API_KEY en backend/.env.simulation. ' +
        'Es la `apiKey` pública del proyecto (la misma de frontend/lib/firebase.ts).'
    )
  }
  return k
}

/** Sesión de un usuario de prueba, con renovación perezosa del ID token. */
class SesionFirebase {
  private idToken = ''
  private venceEn = 0

  constructor(readonly uid: string) {}

  async token(): Promise<string> {
    if (this.idToken && Date.now() < this.venceEn - MARGEN_RENOVACION_MS) return this.idToken

    const auth = await obtenerAdminAuth()
    const customToken = await auth.createCustomToken(this.uid)

    const res = await fetch(`${IDENTITY_TOOLKIT}?key=${apiKeyWeb()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    })
    const json = (await res.json()) as {
      idToken?: string
      expiresIn?: string
      error?: { message?: string }
    }
    if (!res.ok || !json.idToken) {
      throw new Error(
        `No se pudo canjear el token de ${this.uid}: ${json.error?.message ?? `HTTP ${res.status}`}`
      )
    }

    this.idToken = json.idToken
    this.venceEn = Date.now() + Number(json.expiresIn ?? 3600) * 1000
    return this.idToken
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente REST
// ─────────────────────────────────────────────────────────────────────────────

class ClienteApi {
  constructor(
    private readonly baseUrl: string,
    private readonly sesion: SesionFirebase
  ) {}

  async pedir<T>(metodo: string, ruta: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.sesion.token()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const texto = await res.text()
    if (!res.ok) {
      let msg = texto
      try {
        const j = JSON.parse(texto) as { error?: string; code?: string }
        msg = [j.error, j.code && `(${j.code})`].filter(Boolean).join(' ')
      } catch {
        /* respuesta no-JSON: dejamos el cuerpo crudo */
      }
      throw new Error(`${metodo} ${ruta} → HTTP ${res.status}: ${msg}`)
    }
    return (texto ? JSON.parse(texto) : null) as T
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Participante simulado
// ─────────────────────────────────────────────────────────────────────────────

type EstadoVisible = 'en ruta' | 'parado' | 'atrasado' | 'desviado' | 'incidente' | 'llegó'

type ParadaProgramada = {
  distM: number
  duracionSeg: number
  motivo: string
  categoria: string
  /** Las planificadas se registran como Parada voluntaria; las extra no (RN-036). */
  registrar: boolean
  hecha: boolean
}

type PingSimulado = {
  viajeId: string
  lat: number
  lng: number
  accuracy: number
  recordedAt: string
  source: 'live'
  /** Fuera del contrato de `viaje:gps_ping`: Zod los descarta. Ver README. */
  speed: number
  heading: number
}

type SocketLike = {
  connected: boolean
  emit(evento: string, ...args: unknown[]): unknown
  on(evento: string, cb: (...args: unknown[]) => void): unknown
  disconnect(): unknown
  auth: unknown
  io: { on(evento: string, cb: (...args: unknown[]) => void): unknown; opts: Record<string, unknown> }
}

class Participante {
  distM = 0
  velActualKmh = 0
  rumboActual = 0
  estado: EstadoVisible = 'en ruta'
  paradaHastaSeg: number | null = null
  paradaEnCursoRegistrada = false
  paradaActual: ParadaProgramada | null = null
  detenidoDefinitivo = false
  pingsEnviados = 0
  pingsRechazados = 0

  readonly sesion: SesionFirebase
  readonly api: ClienteApi
  socket: SocketLike | null = null

  private readonly paradas: ParadaProgramada[]

  constructor(
    readonly nombre: string,
    readonly uid: string,
    readonly comportamiento: Comportamiento,
    readonly ruta: Ruta,
    paradasPlan: ParadaProgramada[],
    baseUrl: string
  ) {
    this.sesion = new SesionFirebase(uid)
    this.api = new ClienteApi(baseUrl, this.sesion)

    const propias: ParadaProgramada[] = []
    if (typeof comportamiento !== 'string' && comportamiento.tipo === 'parada_extra') {
      propias.push({
        distM: comportamiento.atKm * 1000,
        duracionSeg: comportamiento.duracionSegundos,
        motivo: comportamiento.motivo,
        categoria: 'otro',
        registrar: false,
        hecha: false,
      })
    }
    this.paradas = [...paradasPlan, ...propias].sort((a, b) => a.distM - b.distM)
  }

  get tipoComportamiento(): string {
    return tipoComportamiento(this.comportamiento)
  }

  get llego(): boolean {
    return this.distM >= this.ruta.largoM
  }

  /** Se sigue moviendo alguna vez, o quedó clavado por un incidente. */
  get puedeAvanzar(): boolean {
    return !this.detenidoDefinitivo && !this.llego
  }

  /** Multiplicador de velocidad para el punto actual de la ruta. */
  private factorVelocidad(): number {
    const c = this.comportamiento
    if (typeof c === 'string' || c.tipo !== 'atrasado') return 1
    if (!c.progresivo) return c.factorVelocidad
    const frac = this.ruta.largoM > 0 ? Math.min(1, this.distM / this.ruta.largoM) : 0
    return 1 - (1 - c.factorVelocidad) * frac
  }

  /** Apartamiento lateral en metros respecto de la traza planificada. */
  private desvioLateralM(): number {
    const c = this.comportamiento
    if (typeof c === 'string' || c.tipo !== 'desvio') return 0

    const desdeM = c.desdeKm * 1000
    const rel = this.distM - desdeM
    if (rel <= 0) return 0

    // Rampa de 150 m para entrar y para volver: un salto seco daría una velocidad
    // implícita absurda entre dos pings y el backend lo filtraría como outlier.
    const rampaM = 150
    const largoM = c.largoKm * 1000

    if (!c.vuelve) return c.metros * Math.min(1, rel / rampaM)
    if (rel >= largoM + rampaM) return 0
    if (rel <= rampaM) return c.metros * (rel / rampaM)
    if (rel <= largoM) return c.metros
    return c.metros * (1 - (rel - largoM) / rampaM)
  }

  /**
   * Avanza el reloj simulado un tick. Devuelve la parada que arranca o termina en
   * este tick, para que el orquestador la registre por REST si corresponde.
   */
  avanzar(tSimSeg: number, intervaloSeg: number, baseKmh: number): {
    inicia?: ParadaProgramada
    finaliza?: ParadaProgramada
  } {
    const c = this.comportamiento
    const evento: { inicia?: ParadaProgramada; finaliza?: ParadaProgramada } = {}

    if (this.detenidoDefinitivo) {
      this.velActualKmh = 0
      this.estado = 'incidente'
      return evento
    }

    // ¿Sigue detenido en una parada?
    if (this.paradaHastaSeg != null) {
      if (tSimSeg < this.paradaHastaSeg) {
        this.velActualKmh = 0
        this.estado = 'parado'
        return evento
      }
      this.paradaHastaSeg = null
      if (this.paradaEnCursoRegistrada && this.paradaActual) evento.finaliza = this.paradaActual
      this.paradaEnCursoRegistrada = false
      this.paradaActual = null
    }

    if (this.llego) {
      this.velActualKmh = 0
      this.estado = 'llegó'
      return evento
    }

    const factor = this.factorVelocidad()
    const velKmh = baseKmh * factor
    const avanceM = (velKmh / 3.6) * intervaloSeg

    // Incidente: se detiene en atKm y no vuelve a moverse.
    if (typeof c !== 'string' && c.tipo === 'incidente') {
      const puntoM = c.atKm * 1000
      if (this.distM + avanceM >= puntoM) {
        this.distM = Math.min(puntoM, this.ruta.largoM)
        this.detenidoDefinitivo = true
        this.velActualKmh = 0
        this.estado = 'incidente'
        return evento
      }
    }

    // ¿Cruza una parada en este tick? Clampeamos al punto exacto de la parada.
    const proxima = this.paradas.find((p) => !p.hecha)
    if (proxima && this.distM + avanceM >= proxima.distM) {
      this.distM = Math.min(proxima.distM, this.ruta.largoM)
      proxima.hecha = true
      this.paradaHastaSeg = tSimSeg + proxima.duracionSeg
      this.paradaEnCursoRegistrada = proxima.registrar
      this.paradaActual = proxima
      this.velActualKmh = 0
      this.estado = 'parado'
      if (proxima.registrar) evento.inicia = proxima
      return evento
    }

    this.distM = Math.min(this.distM + avanceM, this.ruta.largoM)
    this.velActualKmh = velKmh
    this.estado = this.llego
      ? 'llegó'
      : this.desvioLateralM() > 0
        ? 'desviado'
        : factor < 0.97
          ? 'atrasado'
          : 'en ruta'
    return evento
  }

  /** Construye el ping de este tick: posición sobre la ruta + desvío + ruido GPS. */
  ping(viajeId: string, recordedAt: Date, ruidoM: number): PingSimulado {
    const sobreRuta = this.ruta.en(this.distM)
    this.rumboActual = sobreRuta.rumbo

    const lateral = this.desvioLateralM()
    const conDesvio = lateral > 0
      ? desplazar(sobreRuta, lateral, (sobreRuta.rumbo + 90) % 360)
      : { lat: sobreRuta.lat, lng: sobreRuta.lng }

    // Ruido independiente en los ejes norte y este.
    const conRuido = desplazar(
      desplazar(conDesvio, ruidoGaussiano(ruidoM), 0),
      ruidoGaussiano(ruidoM),
      90
    )

    return {
      viajeId,
      lat: Number(conRuido.lat.toFixed(6)),
      lng: Number(conRuido.lng.toFixed(6)),
      accuracy: Number(Math.max(3, Math.min(25, 5 + Math.abs(ruidoGaussiano(6)))).toFixed(1)),
      recordedAt: recordedAt.toISOString(),
      source: 'live',
      speed: Number((this.velActualKmh / 3.6).toFixed(2)),
      heading: Number(this.rumboActual.toFixed(1)),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentación por consola
// ─────────────────────────────────────────────────────────────────────────────

const usarColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
/** Prefijo ANSI construido en runtime para no meter caracteres de control en el fuente. */
const ESC = String.fromCharCode(27) + '['
const col = (codigo: string, txt: string) => (usarColor ? `${ESC}${codigo}m${txt}${ESC}0m` : txt)
const gris = (t: string) => col('90', t)
const cian = (t: string) => col('36', t)
const amarillo = (t: string) => col('33', t)
const rojo = (t: string) => col('31', t)
const verde = (t: string) => col('32', t)

const COLOR_ESTADO: Record<EstadoVisible, (t: string) => string> = {
  'en ruta': verde,
  parado: cian,
  atrasado: amarillo,
  desviado: amarillo,
  'llegó': gris,
  incidente: rojo,
}

function hhmmss(seg: number): string {
  const s = Math.max(0, Math.round(seg))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

function renderTick(tSimSeg: number, opts: Opciones, participantes: Participante[]): void {
  const cabecera = `${hhmmss(tSimSeg)} sim  ·  x${opts.speed}${opts.dryRun ? '  ·  DRY-RUN' : ''}`
  const relleno = '-'.repeat(Math.max(2, 46 - cabecera.length))
  const lineas = [gris(`-- ${cabecera} ${relleno}`)]
  for (const p of participantes) {
    lineas.push(
      '   ' +
        p.nombre.padEnd(16) +
        `${(p.distM / 1000).toFixed(2)} km`.padStart(9) +
        `${p.velActualKmh.toFixed(1)} km/h`.padStart(11) +
        `${Math.round(p.rumboActual)} deg`.padStart(9) +
        '   ' +
        COLOR_ESTADO[p.estado](p.estado)
    )
  }
  console.log(lineas.join('\n'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Transporte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un socket por participante: el backend saca el usuario de `socket.data.userId`
 * (puesto en el handshake), no del payload. No hay forma de multiplexar.
 */
async function conectarSocket(
  url: string,
  sesion: SesionFirebase,
  nombre: string
): Promise<SocketLike> {
  const { io } = (await import('socket.io-client')) as unknown as {
    io: (url: string, opts: Record<string, unknown>) => SocketLike
  }
  const token = await sesion.token()

  const sock = io(url, {
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
  })

  // Igual que frontend/lib/meshSocket.ts: refrescar el token antes de reconectar.
  sock.io.on('reconnect_attempt', () => {
    void sesion.token().then((fresco) => {
      sock.auth = { token: fresco }
      sock.io.opts.extraHeaders = { Authorization: `Bearer ${fresco}` }
    })
  })

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout conectando el socket de ${nombre}`)),
      15_000
    )
    sock.on('connect', () => {
      clearTimeout(timer)
      resolve()
    })
    sock.on('connect_error', (err: unknown) => {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : String(err)
      reject(new Error(`Socket de ${nombre} rechazado: ${msg}`))
    })
  })

  return sock
}

/** Suscribe al primer participante a la room para ver lo que dispara el motor de eventos. */
function escucharEventosDelViaje(sock: SocketLike, viajeId: string): void {
  sock.emit('join_viaje', { viajeId }, (res: unknown) => {
    const r = res as { ok?: boolean; error?: string } | undefined
    if (r?.ok) console.log(gris(`   -> escuchando la room viaje:${viajeId}`))
    else console.warn(amarillo(`!  join_viaje rechazado: ${r?.error ?? 'sin respuesta'}`))
  })

  sock.on('viaje:alerta', (p: unknown) => {
    const a = (p as { alerta?: { tipo?: string; origen?: string; mensaje?: string } }).alerta
    const limpio = (a?.mensaje ?? '').replace(/^\[afectado:[0-9a-f-]+\]\s*/i, '')
    console.log(rojo(`   [ALERTA ${a?.origen}/${a?.tipo}] ${limpio}`))
  })
  sock.on('viaje:parada_iniciada', (p: unknown) => {
    const d = p as { nombre?: string; estado?: string }
    console.log(cian(`   [PARADA inicio] ${d.nombre ?? '?'} (${d.estado ?? '?'})`))
  })
  sock.on('viaje:parada_finalizada', (p: unknown) => {
    const d = p as { usuarioId?: string }
    console.log(cian(`   [PARADA fin] ${d.usuarioId ?? '?'}`))
  })
  sock.on('viaje:finalizado', () => console.log(gris('   [viaje:finalizado recibido]')))
}

async function enviarPing(p: Participante, ping: PingSimulado, opts: Opciones): Promise<void> {
  if (opts.dryRun) {
    console.log(gris(`   -> ${p.nombre}: ${JSON.stringify(ping)}`))
    return
  }

  if (opts.transport === 'rest') {
    await p.api.pedir('PUT', `/api/viajes/${ping.viajeId}/ubicacion-viva`, {
      lat: ping.lat,
      lng: ping.lng,
      precision: ping.accuracy,
      recordedAt: ping.recordedAt,
    })
    p.pingsEnviados++
    return
  }

  const sock = p.socket
  if (!sock?.connected) {
    p.pingsRechazados++
    return
  }
  sock.emit('viaje:gps_ping', ping, (res: unknown) => {
    const r = res as { ok?: boolean; error?: string } | undefined
    if (r?.ok) {
      p.pingsEnviados++
    } else {
      p.pingsRechazados++
      if (p.pingsRechazados <= 3) {
        console.warn(amarillo(`!  ping de ${p.nombre} rechazado: ${r?.error ?? 'sin ack'}`))
      }
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestación REST (--full)
// ─────────────────────────────────────────────────────────────────────────────

/** `PUT /ruta` acepta como máximo 10 paradas intermedias (putRutaSchema). */
const MAX_PARADAS_RUTA = 10

async function crearViajeCompleto(
  esc: Escenario,
  ruta: Ruta,
  participantes: Participante[]
): Promise<string> {
  const lider = participantes[0]
  const esGrupal = esc.esGrupal ?? participantes.length > 1

  // RN-107: la fecha programada tiene que ser futura. `iniciar` no espera a que llegue.
  const fechaProgramada = new Date(Date.now() + 2 * 60 * 1000).toISOString()

  const viaje = await lider.api.pedir<{ id: string }>('POST', '/api/viajes', {
    nombre: esc.nombre,
    esGrupal,
    tipoActividad: ACTIVIDAD_A_TIPO[esc.actividad],
    fechaProgramada,
  })
  console.log(verde(`✓ viaje creado: ${viaje.id}`) + gris(`  (líder: ${lider.nombre})`))

  // Único camino para sumar participantes sin amistad ni grupo previo: deja al
  // usuario en estado `confirmado` (unirUsuarioAlViaje), y solo mientras esté planificado.
  for (const p of participantes.slice(1)) {
    await p.api.pedir('POST', `/api/viajes/${viaje.id}/unirse-qr`, undefined)
    console.log(verde(`✓ ${p.nombre} se unió como participante confirmado`))
  }

  // Sin ruta guardada el motor no puede evaluar desvío (RN-034) ni atraso (RN-035).
  const paradasRuta = esc.paradas.slice(0, MAX_PARADAS_RUTA).map((p, i) => {
    const distM = p.atKm != null ? p.atKm * 1000 : ruta.distanciaDe(esc.waypoints[p.atWaypoint!])
    const pos = ruta.en(distM)
    return {
      orden: i,
      lat: Number(pos.lat.toFixed(6)),
      lng: Number(pos.lng.toFixed(6)),
      nombre: p.motivo,
      categoria: p.categoria,
    }
  })
  if (esc.paradas.length > MAX_PARADAS_RUTA) {
    console.warn(
      amarillo(
        `!  el escenario tiene ${esc.paradas.length} paradas; solo las primeras ` +
          `${MAX_PARADAS_RUTA} van a la ruta (las demás igual se simulan).`
      )
    )
  }

  await lider.api.pedir('PUT', `/api/viajes/${viaje.id}/ruta`, {
    // RFC 7946: coordinates es [lng, lat], en ese orden (src/lib/geo.ts).
    origen: { type: 'Point', coordinates: [esc.origen.lng, esc.origen.lat] },
    destino: { type: 'Point', coordinates: [esc.destino.lng, esc.destino.lat] },
    origenNombre: esc.origen.nombre ?? null,
    destinoNombre: esc.destino.nombre ?? null,
    linestring: ruta.aGeoJson(),
    tiempoEstimadoSeg: Math.max(1, Math.round((ruta.largoM / 1000 / esc.velocidadBaseKmh) * 3600)),
    paradas: paradasRuta,
  })
  console.log(
    verde('✓ ruta guardada') +
      gris(` (${(ruta.largoM / 1000).toFixed(2)} km, ${paradasRuta.length} paradas)`)
  )

  await lider.api.pedir('POST', `/api/viajes/${viaje.id}/iniciar`, undefined)
  console.log(verde('✓ viaje iniciado'))

  return viaje.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucle de simulación
// ─────────────────────────────────────────────────────────────────────────────

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

let cortado = false

async function correrSimulacion(
  viajeId: string,
  esc: Escenario,
  participantes: Participante[],
  opts: Opciones
): Promise<void> {
  const t0Real = Date.now()
  let tSim = 0
  let graciaRestante = opts.graciaSeg

  console.log(
    gris(
      `\nSimulando ${participantes.length} participante(s) · ping cada ${opts.interval} s ` +
        `simulados · compresión x${opts.speed}` +
        (opts.dryRun ? ' · DRY-RUN (no se emite nada)' : ` · transporte ${opts.transport}`)
    )
  )
  console.log(gris('Ctrl+C para cortar limpio.\n'))

  while (!cortado) {
    // Reloj simulado: con --speed 10, cada tick suma 5 s de recordedAt pero espera
    // 0,5 s reales. Es lo que hace que el motor de eventos (que mide detenciones con
    // el timestamp del ping, no con el reloj de pared) reaccione comprimido.
    const recordedAt = opts.relojReal ? new Date() : new Date(t0Real + tSim * 1000)

    for (const p of participantes) {
      const ev = p.avanzar(tSim, opts.interval, esc.velocidadBaseKmh)

      // Una parada planificada se registra como Parada voluntaria: así el motor no la
      // confunde con un incidente (RN-036). Las `parada_extra` a propósito NO se registran.
      if (!opts.dryRun && ev.inicia) {
        const pos = p.ruta.en(p.distM)
        await p.api
          .pedir('POST', `/api/viajes/${viajeId}/paradas`, {
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
            categoria: ev.inicia.categoria,
          })
          .catch((e: unknown) => console.warn(amarillo(`!  parada de ${p.nombre}: ${String(e)}`)))
      }
      if (!opts.dryRun && ev.finaliza) {
        await p.api
          .pedir('POST', `/api/viajes/${viajeId}/paradas/finalizar`, undefined)
          .catch((e: unknown) => console.warn(amarillo(`!  fin parada ${p.nombre}: ${String(e)}`)))
      }
    }

    for (const p of participantes) {
      await enviarPing(p, p.ping(viajeId, recordedAt, opts.ruidoM), opts).catch((e: unknown) => {
        p.pingsRechazados++
        if (p.pingsRechazados <= 3) console.warn(amarillo(`!  ${p.nombre}: ${String(e)}`))
      })
    }

    renderTick(tSim, opts, participantes)

    // Cuando ya nadie se mueve seguimos pingueando `--grace` segundos simulados más:
    // el incidente (RN-036) necesita varios minutos de quietud para dispararse.
    const alguienSeMueve = participantes.some((p) => p.puedeAvanzar)
    if (!alguienSeMueve) {
      graciaRestante -= opts.interval
      if (graciaRestante <= 0) break
    }

    tSim += opts.interval
    await dormir((opts.interval * 1000) / opts.speed)
  }

  const realSeg = (Date.now() - t0Real) / 1000
  console.log(
    gris(
      `\nSimulación terminada: ${hhmmss(tSim)} simulados en ${hhmmss(realSeg)} reales.`
    )
  )
  for (const p of participantes) {
    console.log(
      gris(
        `   ${p.nombre.padEnd(16)} ${(p.distM / 1000).toFixed(2)} km · ` +
          `${p.pingsEnviados} pings ok · ${p.pingsRechazados} rechazados`
      )
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parsearArgs(process.argv.slice(2))
  const esc = cargarEscenario(opts.scenario)

  console.log(`\n${cian(esc.nombre)} ${gris(`(${esc.actividad} → ${ACTIVIDAD_A_TIPO[esc.actividad]})`)}`)

  // 1. Geometría de la ruta.
  const waypoints: LatLng[] = [esc.origen, ...esc.waypoints, esc.destino]
  const perfil = esc.perfilOsrm ?? PERFIL_OSRM[esc.actividad]
  const { geo, origen } = await obtenerGeometria(perfil, waypoints, opts.sinCache)
  const ruta = new Ruta(geo.coordinates.map(([lng, lat]) => ({ lat, lng })))
  console.log(
    gris(
      `Ruta: ${(ruta.largoM / 1000).toFixed(2)} km · ${ruta.puntos.length} vértices · ` +
        `perfil ${perfil} · origen ${origen}`
    )
  )

  // 2. Paradas planificadas → distancias sobre la traza.
  const paradasPlan: ParadaProgramada[] = esc.paradas.map((p) => {
    let distM: number
    if (p.atKm != null) {
      distM = p.atKm * 1000
    } else {
      const wp = esc.waypoints[p.atWaypoint!]
      if (!wp) throw new Error(`atWaypoint ${p.atWaypoint} fuera de rango (waypoints: ${esc.waypoints.length})`)
      distM = ruta.distanciaDe(wp)
    }
    if (distM > ruta.largoM) {
      console.warn(amarillo(`!  parada "${p.motivo}" a ${(distM / 1000).toFixed(2)} km queda fuera de la ruta; se ignora.`))
    }
    return {
      distM,
      duracionSeg: p.duracionSegundos,
      motivo: p.motivo,
      categoria: p.categoria,
      registrar: true,
      hecha: distM > ruta.largoM,
    }
  })

  // 3. Participantes.
  const participantes = esc.participantes.map(
    (p) => new Participante(p.nombre, p.userId, p.comportamiento, ruta, paradasPlan.map((x) => ({ ...x })), opts.apiUrl)
  )
  for (const p of participantes) {
    console.log(gris(`   · ${p.nombre.padEnd(16)} uid=${p.uid}  comportamiento=${p.tipoComportamiento}`))
  }

  if (opts.dryRun && !opts.viajeId) {
    console.log(amarillo('\nDRY-RUN sin --viaje-id: se usa un UUID de relleno en el payload.'))
  }

  // 4. Viaje.
  let viajeId = opts.viajeId ?? '00000000-0000-4000-8000-000000000000'
  if (!opts.dryRun) {
    if (opts.full) {
      viajeId = await crearViajeCompleto(esc, ruta, participantes)
    } else {
      console.log(gris(`Usando el viaje existente ${viajeId} (tiene que estar en curso).`))
    }

    // 5. Sockets. En modo REST igual conectamos el del líder para ver los eventos.
    const necesitanSocket = opts.transport === 'socket' ? participantes : participantes.slice(0, 1)
    for (const p of necesitanSocket) {
      p.socket = await conectarSocket(opts.socketUrl, p.sesion, p.nombre)
    }
    console.log(verde(`✓ ${necesitanSocket.length} socket(s) conectado(s)`))
    if (participantes[0].socket) escucharEventosDelViaje(participantes[0].socket, viajeId)
  }

  // 6. Simular.
  await correrSimulacion(viajeId, esc, participantes, opts)

  // 7. Cierre.
  if (!opts.dryRun && opts.full && !cortado) {
    await participantes[0].api
      .pedir('POST', `/api/viajes/${viajeId}/finalizar`, undefined)
      .then(() => console.log(verde('✓ viaje finalizado')))
      .catch((e: unknown) => console.warn(amarillo(`!  no se pudo finalizar: ${String(e)}`)))
  }

  desconectarTodo(participantes)

  if (cortado && opts.full) {
    console.log(
      amarillo(
        `\nEl viaje ${viajeId} quedó EN CURSO. Para cerrarlo:\n` +
          `  npm run simulate -- --scenario ${opts.scenario} --viaje-id ${viajeId} --dry-run\n` +
          '  (o finalizalo desde la app con el usuario líder)'
      )
    )
  } else if (!opts.dryRun) {
    console.log(gris(`\nviajeId: ${viajeId}`))
  }
}

function desconectarTodo(participantes: Participante[]): void {
  for (const p of participantes) {
    try {
      p.socket?.disconnect()
    } catch {
      /* ya estaba cerrado */
    }
    p.socket = null
  }
}

process.on('SIGINT', () => {
  if (cortado) {
    console.log(rojo('\nSegundo Ctrl+C: salida forzada.'))
    process.exit(130)
  }
  cortado = true
  console.log(amarillo('\nCortando… cerrando sockets y terminando el tick en curso.'))
})

main()
  .then(() => process.exit(cortado ? 130 : 0))
  .catch((e: unknown) => {
    console.error(rojo(`\n${e instanceof Error ? e.message : String(e)}`))
    process.exit(1)
  })
