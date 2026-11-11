/**
 * Simulador de trazas GPS para el seed de demo.
 *
 * Genera, sobre un trazado real, los pings que habría mandado el celular de cada
 * integrante: uno cada 5 s (RN-031), con deriva de GPS, paradas, altitud y velocidad.
 * Es determinístico (misma semilla, misma traza) y no toca la base: devuelve datos.
 *
 * Los valores se mantienen dentro de los filtros de `lib/gpsFilters.ts`; si no, las
 * métricas reales del backend descartarían los tramos como ruido.
 *
 * Solo lo usa el seed (`npm run demo:seed`). La app nunca importa este archivo.
 */
import type { TipoActividad } from '@prisma/client'
import type { PerfilAltura } from './rutas.catalogo'

export type Punto = [lat: number, lng: number]

export type PuntoGps = {
  lat: number
  lng: number
  timestamp: Date
  precision_m: number
  altitud_m: number
  precision_altitud_m: number
  velocidad_kmh: number
  rumbo_grados: number | null
}

/** Segundos entre pings (RN-031). */
const PASO_SEG = 5
const R_TIERRA_M = 6_371_000
const RAD = Math.PI / 180

/** PRNG mulberry32: alcanza para variar las trazas y es reproducible. */
export function crearAzar(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function distanciaM(a: Punto, b: Punto): number {
  const dLat = (b[0] - a[0]) * RAD
  const dLng = (b[1] - a[1]) * RAD
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * R_TIERRA_M * Math.asin(Math.sqrt(s))
}

function rumbo(a: Punto, b: Punto): number {
  const y = Math.sin((b[1] - a[1]) * RAD) * Math.cos(b[0] * RAD)
  const x =
    Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) -
    Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos((b[1] - a[1]) * RAD)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

/** Trazado con distancia acumulada, para ubicar un punto a `d` metros del inicio. */
export class Camino {
  readonly puntos: Punto[]
  private readonly acumulado: number[]
  readonly largoM: number

  constructor(puntos: Punto[]) {
    this.puntos = puntos
    this.acumulado = [0]
    for (let i = 1; i < puntos.length; i++) {
      this.acumulado.push(this.acumulado[i - 1]! + distanciaM(puntos[i - 1]!, puntos[i]!))
    }
    this.largoM = this.acumulado[this.acumulado.length - 1]!
  }

  posicion(d: number): Punto {
    const objetivo = Math.max(0, Math.min(this.largoM, d))
    let lo = 0
    let hi = this.acumulado.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.acumulado[mid]! <= objetivo) lo = mid
      else hi = mid
    }
    const tramo = this.acumulado[hi]! - this.acumulado[lo]!
    const t = tramo === 0 ? 0 : (objetivo - this.acumulado[lo]!) / tramo
    const a = this.puntos[lo]!
    const b = this.puntos[hi]!
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
}

type Movimiento = {
  /** Velocidad de crucero en km/h. */
  base: number
  /** Dos ondas de variación de ritmo: amplitud relativa y largo de onda en metros. */
  a1: number
  l1: number
  a2: number
  l2: number
  /** Cuánto frena la pendiente (por unidad de pendiente) y los topes del factor. */
  pendiente: number
  fMin: number
  fMax: number
  /** Deriva típica del GPS en metros. */
  ruidoM: number
}

const MOVIMIENTO: Record<TipoActividad, Movimiento> = {
  moto: { base: 76, a1: 0.2, l1: 2600, a2: 0.09, l2: 650, pendiente: 0, fMin: 1, fMax: 1, ruidoM: 1.6 },
  auto: { base: 70, a1: 0.18, l1: 3000, a2: 0.08, l2: 700, pendiente: 0, fMin: 1, fMax: 1, ruidoM: 1.6 },
  bici: { base: 25.5, a1: 0.12, l1: 1800, a2: 0.06, l2: 420, pendiente: 8, fMin: 0.6, fMax: 1.3, ruidoM: 1.4 },
  running: { base: 10.6, a1: 0.05, l1: 900, a2: 0.03, l2: 250, pendiente: 4, fMin: 0.82, fMax: 1.08, ruidoM: 1.2 },
  trekking: { base: 4.8, a1: 0.07, l1: 500, a2: 0.04, l2: 160, pendiente: 2.5, fMin: 0.82, fMax: 1.1, ruidoM: 0.9 },
  otro: { base: 6, a1: 0.06, l1: 600, a2: 0.03, l2: 200, pendiente: 3, fMin: 0.82, fMax: 1.1, ruidoM: 1.2 },
}

/** Velocidad de crucero de cada actividad, en km/h (la usa el relleno sin traza). */
export function velocidadCruceroKmh(actividad: TipoActividad): number {
  return MOVIMIENTO[actividad].base
}

/** Altura sintética a la fracción `f` (0–1) del trazado planificado. */
function alturaEn(fraccion: number, perfil: PerfilAltura): number {
  const f = Math.max(0, Math.min(1, fraccion))
  const rango = perfil.pico - perfil.base
  if (perfil.forma === 'llano') return perfil.base + rango * (0.5 - 0.5 * Math.cos(f * Math.PI * 6))
  if (perfil.forma === 'subida') return perfil.base + rango * (f * f * (3 - 2 * f))
  return perfil.base + rango * Math.sin(Math.PI * f) ** 1.2
}

export type ParadaSimulada = {
  /** Posición sobre la traza completa, de 0 a 1. */
  fraccion: number
  minutos: number
}

export type IntegranteSimulado = {
  clave: string
  /** Multiplicador de la velocidad de crucero (1 = la de la actividad). */
  ritmo?: number
  /** Paradas que hace solo esta persona; después alcanza al grupo. */
  paradas?: ParadaSimulada[]
  /** Abandona el viaje al llegar a esta fracción de la traza. */
  saleEnFraccion?: number
}

export type OpcionesSimulacion = {
  /** Trazado planificado (ida). */
  camino: Punto[]
  actividad: TipoActividad
  altura: PerfilAltura
  inicio: Date
  semilla: number
  /** Vuelve por el mismo camino. */
  vuelta?: boolean
  /** Termina al llegar a esta distancia aunque el camino siga. */
  cortarEnM?: number
  /** Paradas de todo el grupo. Se ignoran con `libre`. */
  paradasGrupo?: ParadaSimulada[]
  /** El primero es quien marca el paso (el líder del viaje). */
  integrantes: IntegranteSimulado[]
  /** Cada uno a su ritmo, sin esperarse (viajes competitivos). */
  libre?: boolean
}

export type ParadaResultante = {
  /** null = parada de todo el grupo. */
  clave: string | null
  inicio: Date
  fin: Date
  lat: number
  lng: number
}

export type ResultadoSimulacion = {
  trazas: Map<string, PuntoGps[]>
  paradas: ParadaResultante[]
  /** Momento del último ping de todo el viaje. */
  fin: Date
  /** Largo de la traza simulada, en metros. */
  largoM: number
}

type Avance = {
  /** Metros recorridos en cada tick de 5 s. */
  d: number[]
  /** Ticks en los que la persona estuvo parada: [inicio, fin). */
  paradas: { desde: number; hasta: number; d: number; nominal: number }[]
}

export function simularViaje(op: OpcionesSimulacion): ResultadoSimulacion {
  const azar = crearAzar(op.semilla)
  const ida = new Camino(op.camino)
  const puntos = op.vuelta ? [...op.camino, ...[...op.camino].reverse().slice(1)] : op.camino
  const camino = new Camino(puntos)
  const largoM = Math.min(camino.largoM, op.cortarEnM ?? Infinity)
  const mov = MOVIMIENTO[op.actividad]

  /** Fracción del trazado planificado: en la vuelta se desanda. */
  const fraccionRuta = (d: number) => {
    const f = d / ida.largoM
    return f <= 1 ? f : Math.max(0, 2 - f)
  }
  const altura = (d: number) => alturaEn(fraccionRuta(d), op.altura)
  const pendiente = (d: number) => (altura(d + 40) - altura(d - 40)) / 80

  const velocidadMs = (d: number, ritmo: number, fase1: number, fase2: number) => {
    const onda =
      1 +
      mov.a1 * Math.sin((d / mov.l1) * 2 * Math.PI + fase1) +
      mov.a2 * Math.sin((d / mov.l2) * 2 * Math.PI + fase2)
    const freno = Math.max(mov.fMin, Math.min(mov.fMax, 1 - mov.pendiente * pendiente(d)))
    return (mov.base / 3.6) * ritmo * onda * freno
  }

  /** Avance de alguien que marca su propio paso. */
  const avanzarSolo = (
    ritmo: number,
    paradas: ParadaSimulada[],
    hastaM: number,
    fase1: number,
    fase2: number
  ): Avance => {
    const pendientes = [...paradas]
      .map((p) => ({ d: p.fraccion * largoM, ticks: Math.round((p.minutos * 60) / PASO_SEG) }))
      .filter((p) => p.d < hastaM)
      .sort((a, b) => a.d - b.d)
    const avance: Avance = { d: [0], paradas: [] }
    let d = 0
    while (d < hastaM && avance.d.length < 40_000) {
      const parada = pendientes[0]
      if (parada && d >= parada.d) {
        pendientes.shift()
        const desde = avance.d.length
        for (let i = 0; i < parada.ticks; i++) avance.d.push(d)
        avance.paradas.push({ desde, hasta: avance.d.length, d, nominal: parada.d })
        continue
      }
      d = Math.min(hastaM, d + velocidadMs(d, ritmo, fase1, fase2) * PASO_SEG)
      avance.d.push(d)
    }
    return avance
  }

  const lider = op.integrantes[0]!
  const faseLider: [number, number] = [azar() * 6.28, azar() * 6.28]
  const avanceLider = avanzarSolo(
    lider.ritmo ?? 1,
    op.libre ? (lider.paradas ?? []) : [...(op.paradasGrupo ?? []), ...(lider.paradas ?? [])],
    (lider.saleEnFraccion ?? 1) * largoM,
    faseLider[0],
    faseLider[1]
  )

  const avances = new Map<string, Avance>([[lider.clave, avanceLider]])
  op.integrantes.slice(1).forEach((integrante, i) => {
    const hastaM = (integrante.saleEnFraccion ?? 1) * largoM
    if (op.libre) {
      avances.set(
        integrante.clave,
        avanzarSolo(integrante.ritmo ?? 1, integrante.paradas ?? [], hastaM, azar() * 6.28, azar() * 6.28)
      )
      return
    }

    // En grupo cada uno sigue al líder unos segundos más atrás. Si para por su cuenta,
    // después acelera hasta volver a su lugar.
    const retraso = 1 + ((i * 2 + Math.floor(azar() * 2)) % 6)
    const propias = (integrante.paradas ?? [])
      .map((p) => ({ d: p.fraccion * largoM, ticks: Math.round((p.minutos * 60) / PASO_SEG) }))
      .sort((a, b) => a.d - b.d)
    const avance: Avance = { d: [0], paradas: [] }
    let d = 0
    for (let k = 1; k < avanceLider.d.length + retraso + 2000 && d < hastaM; k++) {
      const objetivo = Math.min(
        hastaM,
        avanceLider.d[Math.min(avanceLider.d.length - 1, Math.max(0, k - retraso))]!
      )
      const propia = propias[0]
      if (propia && d >= propia.d) {
        propias.shift()
        const desde = avance.d.length
        for (let j = 0; j < propia.ticks; j++) avance.d.push(d)
        avance.paradas.push({ desde, hasta: avance.d.length, d, nominal: propia.d })
        k += propia.ticks - 1
        continue
      }
      const tope = velocidadMs(d, 1.22, faseLider[0], faseLider[1]) * PASO_SEG
      d += Math.max(0, Math.min(objetivo - d, tope))
      avance.d.push(d)
      // El líder ya llegó y esta persona también: no hace falta seguir.
      if (k - retraso >= avanceLider.d.length - 1 && objetivo - d < 0.5) break
    }
    avances.set(integrante.clave, avance)
  })

  const inicioMs = op.inicio.getTime()
  const instante = (tick: number) => new Date(inicioMs + tick * PASO_SEG * 1000)
  const trazas = new Map<string, PuntoGps[]>()
  const paradas: ParadaResultante[] = []
  let finMs = inicioMs

  op.integrantes.forEach((integrante, indice) => {
    const avance = avances.get(integrante.clave)!
    // Cada celular tiene su propio corrimiento fijo y su propia deriva.
    const corrimiento: [number, number] = [(azar() - 0.5) * 3, (azar() - 0.5) * 3]
    let derivaN = 0
    let derivaE = 0
    let anterior: Punto | null = null
    const traza: PuntoGps[] = []

    avance.d.forEach((d, tick) => {
      derivaN = derivaN * 0.97 + (azar() - 0.5) * 0.9 * mov.ruidoM
      derivaE = derivaE * 0.97 + (azar() - 0.5) * 0.9 * mov.ruidoM
      const base = camino.posicion(d)
      const lat = base[0] + (corrimiento[0] + derivaN) / 111_320
      const lng = base[1] + (corrimiento[1] + derivaE) / (111_320 * Math.cos(base[0] * RAD))
      const avanzoM = tick === 0 ? 0 : d - avance.d[tick - 1]!
      const actual: Punto = [lat, lng]
      traza.push({
        lat,
        lng,
        timestamp: instante(tick),
        precision_m: Math.round((4 + azar() * 5) * 10) / 10,
        altitud_m: Math.round((altura(d) + (azar() - 0.5) * 2.4) * 10) / 10,
        precision_altitud_m: Math.round((3 + azar() * 4) * 10) / 10,
        velocidad_kmh: Math.max(0, Math.round((avanzoM / PASO_SEG) * 3.6 * 10) / 10),
        rumbo_grados: anterior && avanzoM > 1 ? Math.round(rumbo(anterior, actual)) : null,
      })
      anterior = actual
    })

    trazas.set(integrante.clave, traza)
    finMs = Math.max(finMs, traza[traza.length - 1]!.timestamp.getTime())

    for (const p of avance.paradas) {
      const [lat, lng] = camino.posicion(p.d)
      // Las del líder que vienen de `paradasGrupo` son de todos; el resto, personales.
      const esGrupal =
        indice === 0 &&
        !op.libre &&
        (op.paradasGrupo ?? []).some((g) => Math.abs(g.fraccion * largoM - p.nominal) < 0.001)
      paradas.push({
        clave: esGrupal ? null : integrante.clave,
        inicio: instante(p.desde),
        fin: instante(p.hasta),
        lat,
        lng,
      })
    }
  })

  return { trazas, paradas, fin: new Date(finMs), largoM }
}
