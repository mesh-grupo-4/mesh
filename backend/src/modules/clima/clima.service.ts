import type { PrismaClient } from '@prisma/client'
import { distanciaMetros } from '../../lib/geo2d'
import type { GeoJsonLineString } from '../../lib/geo'
import { HttpError } from '../../lib/httpError'

/**
 * Pronóstico meteorológico sobre la ruta planificada (SCRUM-27, RN-108).
 * Proveedor: Open-Meteo (https://open-meteo.com), gratuito y sin API key —
 * misma política de costo cero que OpenStreetMap para los mapas.
 */
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const TIMEOUT_MS = 8000
/** Open-Meteo pronostica hasta 16 días; más allá no hay datos. */
const HORIZONTE_DIAS = 16
/** Un pronóstico horario no cambia minuto a minuto: se cachea por viaje. */
const CACHE_TTL_MS = 15 * 60 * 1000
/** Como máximo esta cantidad de puntos de la ruta se consultan. */
const MAX_PUNTOS = 8
/** Si la ruta trae pocas paradas, se agregan tramos intermedios hasta llegar a esto. */
const MIN_PUNTOS = 5

/** RN-108: umbrales a partir de los cuales se alerta. */
export const UMBRALES_CLIMA = {
  probLluviaPct: 50,
  precipitacionMm: 0.5,
  vientoKmh: 35,
  rafagasKmh: 55,
} as const

export type PuntoClima = {
  nombre: string
  lat: number
  lng: number
  /** Instante (UTC) para el que se leyó el pronóstico en este punto. */
  hora: string
  temperatura_c: number | null
  prob_precipitacion_pct: number | null
  precipitacion_mm: number | null
  viento_kmh: number | null
  rafagas_kmh: number | null
  codigo_tiempo: number | null
  descripcion: string
  lluvia: boolean
  viento_fuerte: boolean
}

export type AlertaClima = {
  tipo: 'lluvia' | 'viento_fuerte'
  mensaje: string
  puntos: string[]
}

export type ClimaViaje = {
  disponible: boolean
  motivo: 'SIN_RUTA' | 'FUERA_DE_HORIZONTE' | 'VIAJE_FINALIZADO' | null
  fuente: 'open-meteo'
  consultado_en: string
  inicio_previsto: string | null
  puntos: PuntoClima[]
  alertas: AlertaClima[]
  resumen: string
}

type OpenMeteoHourly = {
  time: string[]
  temperature_2m?: (number | null)[]
  precipitation_probability?: (number | null)[]
  precipitation?: (number | null)[]
  wind_speed_10m?: (number | null)[]
  wind_gusts_10m?: (number | null)[]
  weather_code?: (number | null)[]
}

type OpenMeteoRespuesta = { hourly?: OpenMeteoHourly }

type PuntoMuestra = { nombre: string; lat: number; lng: number; fraccion: number }

/** Descripción en español de los códigos WMO que devuelve Open-Meteo. */
export function descripcionCodigoTiempo(codigo: number | null): string {
  if (codigo == null) return 'Sin datos'
  if (codigo === 0) return 'Despejado'
  if (codigo <= 2) return 'Parcialmente nublado'
  if (codigo === 3) return 'Nublado'
  if (codigo === 45 || codigo === 48) return 'Niebla'
  if (codigo >= 51 && codigo <= 57) return 'Llovizna'
  if (codigo >= 61 && codigo <= 67) return 'Lluvia'
  if (codigo >= 71 && codigo <= 77) return 'Nieve'
  if (codigo >= 80 && codigo <= 82) return 'Chubascos'
  if (codigo === 85 || codigo === 86) return 'Chubascos de nieve'
  if (codigo >= 95) return 'Tormenta'
  return 'Sin datos'
}

function codigoImplicaLluvia(codigo: number | null): boolean {
  if (codigo == null) return false
  return (codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82) || codigo >= 95
}

function fechaIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Índice del vértice del trazado más cercano a un punto (para ubicar paradas en el tiempo). */
function fraccionEnTrazado(lat: number, lng: number, coords: [number, number][]): number {
  if (coords.length < 2) return 0
  let mejor = 0
  let mejorDist = Number.POSITIVE_INFINITY
  coords.forEach(([cLng, cLat], i) => {
    const d = distanciaMetros(lat, lng, cLat, cLng)
    if (d < mejorDist) {
      mejorDist = d
      mejor = i
    }
  })
  return mejor / (coords.length - 1)
}

export class ClimaService {
  private readonly cache = new Map<string, { at: number; data: ClimaViaje }>()

  constructor(
    private readonly prisma: PrismaClient,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async obtenerParaViaje(usuarioId: string, viajeId: string): Promise<ClimaViaje> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: {
        creador_id: true,
        estado: true,
        fecha_programada: true,
        fecha_inicio_real: true,
        integrantes: { where: { usuario_id: usuarioId }, select: { estado: true } },
        ruta: {
          select: {
            origen_lat: true,
            origen_lng: true,
            origen_nombre: true,
            destino_lat: true,
            destino_lng: true,
            destino_nombre: true,
            linestring_geojson: true,
            tiempo_estimado_seg: true,
            paradas_intermedias: {
              orderBy: { orden: 'asc' },
              select: { lat: true, lng: true, nombre: true },
            },
          },
        },
      },
    })
    if (!viaje) throw new HttpError(404, 'Viaje no encontrado', 'VIAJE_NOT_FOUND')

    // RN-030: lo ve quien participa (creador o integrante no rechazado), como el detalle.
    const participa =
      viaje.creador_id === usuarioId ||
      viaje.integrantes.some((i) => i.estado !== 'rechazado')
    if (!participa) throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')

    const consultadoEn = new Date()
    const base: Omit<ClimaViaje, 'disponible' | 'motivo' | 'resumen'> = {
      fuente: 'open-meteo',
      consultado_en: consultadoEn.toISOString(),
      inicio_previsto: null,
      puntos: [],
      alertas: [],
    }

    if (viaje.estado === 'finalizado') {
      return { ...base, disponible: false, motivo: 'VIAJE_FINALIZADO', resumen: 'El viaje ya terminó.' }
    }
    if (!viaje.ruta) {
      return {
        ...base,
        disponible: false,
        motivo: 'SIN_RUTA',
        resumen: 'Configurá la ruta para ver el pronóstico sobre el recorrido.',
      }
    }

    // En curso: lo relevante es el clima de ahora, no el de la hora programada.
    const inicio =
      viaje.estado === 'en_curso'
        ? consultadoEn
        : viaje.fecha_programada.getTime() < consultadoEn.getTime()
          ? consultadoEn
          : viaje.fecha_programada
    base.inicio_previsto = inicio.toISOString()

    const diasHastaInicio = (inicio.getTime() - consultadoEn.getTime()) / 86_400_000
    if (diasHastaInicio > HORIZONTE_DIAS - 1) {
      return {
        ...base,
        disponible: false,
        motivo: 'FUERA_DE_HORIZONTE',
        resumen: `El pronóstico está disponible desde ${HORIZONTE_DIAS - 1} días antes de la salida.`,
      }
    }

    const cacheKey = `${viajeId}:${inicio.toISOString().slice(0, 13)}`
    const cacheada = this.cache.get(cacheKey)
    if (cacheada && consultadoEn.getTime() - cacheada.at < CACHE_TTL_MS) return cacheada.data

    const ruta = viaje.ruta
    const linestring = ruta.linestring_geojson as unknown as GeoJsonLineString
    const coords = (linestring?.coordinates ?? []) as [number, number][]
    const muestras = this.elegirMuestras(
      { lat: ruta.origen_lat, lng: ruta.origen_lng, nombre: ruta.origen_nombre },
      { lat: ruta.destino_lat, lng: ruta.destino_lng, nombre: ruta.destino_nombre },
      ruta.paradas_intermedias,
      coords
    )

    const duracionSeg = ruta.tiempo_estimado_seg ?? 0
    const fin = new Date(inicio.getTime() + duracionSeg * 1000)
    const pronosticos = await this.consultarOpenMeteo(muestras, inicio, fin)

    const puntos: PuntoClima[] = muestras.map((m, i) => {
      const hora = new Date(inicio.getTime() + m.fraccion * duracionSeg * 1000)
      return this.leerHora(m, pronosticos[i]?.hourly, hora)
    })

    const alertas = this.armarAlertas(puntos)
    const data: ClimaViaje = {
      ...base,
      disponible: true,
      motivo: null,
      puntos,
      alertas,
      resumen: this.armarResumen(puntos, alertas),
    }
    this.cache.set(cacheKey, { at: consultadoEn.getTime(), data })
    return data
  }

  /** Origen, paradas y destino; si son pocos, tramos intermedios del trazado. Máximo MAX_PUNTOS. */
  private elegirMuestras(
    origen: { lat: number; lng: number; nombre: string | null },
    destino: { lat: number; lng: number; nombre: string | null },
    paradas: { lat: number; lng: number; nombre: string | null }[],
    coords: [number, number][]
  ): PuntoMuestra[] {
    const muestras: PuntoMuestra[] = [
      { nombre: origen.nombre?.trim() || 'Origen', lat: origen.lat, lng: origen.lng, fraccion: 0 },
    ]
    for (const [i, p] of paradas.slice(0, MAX_PUNTOS - 2).entries()) {
      muestras.push({
        nombre: p.nombre?.trim() || `Parada ${i + 1}`,
        lat: p.lat,
        lng: p.lng,
        fraccion: fraccionEnTrazado(p.lat, p.lng, coords),
      })
    }
    const faltan = MIN_PUNTOS - muestras.length - 1
    if (faltan > 0 && coords.length >= 2) {
      for (let k = 1; k <= faltan; k++) {
        const fraccion = k / (faltan + 1)
        const idx = Math.round(fraccion * (coords.length - 1))
        const [lng, lat] = coords[idx]!
        muestras.push({ nombre: `Tramo ${k}`, lat, lng, fraccion })
      }
    }
    muestras.push({
      nombre: destino.nombre?.trim() || 'Destino',
      lat: destino.lat,
      lng: destino.lng,
      fraccion: 1,
    })
    return muestras.sort((a, b) => a.fraccion - b.fraccion)
  }

  private async consultarOpenMeteo(
    muestras: PuntoMuestra[],
    inicio: Date,
    fin: Date
  ): Promise<OpenMeteoRespuesta[]> {
    const params = new URLSearchParams({
      latitude: muestras.map((m) => m.lat.toFixed(4)).join(','),
      longitude: muestras.map((m) => m.lng.toFixed(4)).join(','),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'precipitation',
        'wind_speed_10m',
        'wind_gusts_10m',
        'weather_code',
      ].join(','),
      timezone: 'UTC',
      start_date: fechaIso(inicio),
      end_date: fechaIso(fin),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await this.fetchImpl(`${OPEN_METEO_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new HttpError(504, 'El servicio meteorológico no respondió a tiempo', 'CLIMA_TIMEOUT')
      }
      throw new HttpError(502, 'No se pudo consultar el servicio meteorológico', 'CLIMA_UPSTREAM_ERROR')
    } finally {
      clearTimeout(timeoutId)
    }
    if (!res.ok) {
      throw new HttpError(502, 'El servicio meteorológico devolvió un error', 'CLIMA_UPSTREAM_ERROR')
    }
    const body = (await res.json()) as OpenMeteoRespuesta | OpenMeteoRespuesta[]
    // Con una sola coordenada Open-Meteo devuelve un objeto, con varias un array.
    return Array.isArray(body) ? body : [body]
  }

  private leerHora(m: PuntoMuestra, hourly: OpenMeteoHourly | undefined, hora: Date): PuntoClima {
    const vacio: PuntoClima = {
      nombre: m.nombre,
      lat: m.lat,
      lng: m.lng,
      hora: hora.toISOString(),
      temperatura_c: null,
      prob_precipitacion_pct: null,
      precipitacion_mm: null,
      viento_kmh: null,
      rafagas_kmh: null,
      codigo_tiempo: null,
      descripcion: 'Sin datos',
      lluvia: false,
      viento_fuerte: false,
    }
    if (!hourly?.time?.length) return vacio

    // Open-Meteo devuelve horas "YYYY-MM-DDTHH:00" en la zona pedida (UTC).
    const objetivo = hora.toISOString().slice(0, 13)
    let idx = hourly.time.findIndex((t) => t.slice(0, 13) === objetivo)
    if (idx < 0) idx = hora.getTime() < Date.parse(`${hourly.time[0]}Z`) ? 0 : hourly.time.length - 1

    const num = (arr?: (number | null)[]) => (arr && arr[idx] != null ? arr[idx]! : null)
    const prob = num(hourly.precipitation_probability)
    const mm = num(hourly.precipitation)
    const viento = num(hourly.wind_speed_10m)
    const rafagas = num(hourly.wind_gusts_10m)
    const codigo = num(hourly.weather_code)

    return {
      ...vacio,
      temperatura_c: num(hourly.temperature_2m),
      prob_precipitacion_pct: prob,
      precipitacion_mm: mm,
      viento_kmh: viento,
      rafagas_kmh: rafagas,
      codigo_tiempo: codigo,
      descripcion: descripcionCodigoTiempo(codigo),
      lluvia:
        (prob != null && prob >= UMBRALES_CLIMA.probLluviaPct) ||
        (mm != null && mm >= UMBRALES_CLIMA.precipitacionMm) ||
        codigoImplicaLluvia(codigo),
      viento_fuerte:
        (viento != null && viento >= UMBRALES_CLIMA.vientoKmh) ||
        (rafagas != null && rafagas >= UMBRALES_CLIMA.rafagasKmh),
    }
  }

  private armarAlertas(puntos: PuntoClima[]): AlertaClima[] {
    const alertas: AlertaClima[] = []
    const conLluvia = puntos.filter((p) => p.lluvia).map((p) => p.nombre)
    if (conLluvia.length > 0) {
      alertas.push({
        tipo: 'lluvia',
        mensaje: `Se espera lluvia en ${conLluvia.length === puntos.length ? 'todo el recorrido' : conLluvia.join(', ')}.`,
        puntos: conLluvia,
      })
    }
    const conViento = puntos.filter((p) => p.viento_fuerte)
    if (conViento.length > 0) {
      const max = Math.max(...conViento.map((p) => Math.max(p.viento_kmh ?? 0, p.rafagas_kmh ?? 0)))
      alertas.push({
        tipo: 'viento_fuerte',
        mensaje: `Viento fuerte (hasta ${Math.round(max)} km/h) en ${conViento.length === puntos.length ? 'todo el recorrido' : conViento.map((p) => p.nombre).join(', ')}.`,
        puntos: conViento.map((p) => p.nombre),
      })
    }
    return alertas
  }

  private armarResumen(puntos: PuntoClima[], alertas: AlertaClima[]): string {
    const temps = puntos.map((p) => p.temperatura_c).filter((t): t is number => t != null)
    const tramoTemp =
      temps.length > 0
        ? ` · ${Math.round(Math.min(...temps))}–${Math.round(Math.max(...temps))} °C`
        : ''
    if (alertas.length === 0) {
      const desc = puntos[0]?.descripcion ?? 'Sin datos'
      return `${desc}${tramoTemp}. Sin alertas de lluvia ni viento en la ruta.`
    }
    return `${alertas.map((a) => (a.tipo === 'lluvia' ? 'Lluvia' : 'Viento fuerte')).join(' y ')} en la ruta${tramoTemp}.`
  }
}
