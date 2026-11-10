import { haversineDistanceM } from '@/lib/geo/haversine'
import { proyectarEnSegmento } from '@/lib/geo/routeProgress'

/**
 * Movimiento fluido del mapa en vivo: entre dos pings GPS (cada 5 s, RN-031)
 * estima dónde va cada integrante para que el marcador avance en vez de saltar.
 *
 * Es SOLO dibujo. Nada de lo que sale de acá se guarda, se envía al backend ni
 * alimenta al motor de eventos, a las métricas o al registro GPS: esos siguen
 * usando únicamente las posiciones reales (RN-038).
 */

type LatLng = { lat: number; lng: number }

export type Seguimiento = LatLng & {
  /** Hora local en que llegó este ping. */
  recibidoEn: number
  /** Velocidad estimada entre los dos últimos pings; 0 = no se extrapola. */
  velocidadMs: number
  rumbo: number | null
  enMovimiento: boolean
  /** Dónde cae este ping sobre la ruta planificada; null = va por fuera de ella. */
  enRuta: (LatLng & { indice: number }) | null
}

/** Ping GPS (5 s) más el margen de latencia de la red. */
const HORIZONTE_MS = 6000
/** Sin ping nuevo pasado este tiempo, el marcador vuelve a la última posición real. */
const VENCIMIENTO_MS = 9000
/** Más lejos que esto de la ruta planificada, se considera que no la está siguiendo. */
const DIST_MAX_RUTA_M = 40
/** Tolerancia entre el rumbo y el sentido de la ruta (descarta ir en contramano). */
const ANGULO_MAX_RUTA = 60
const VELOCIDAD_MIN_MS = 0.5
/** Tope para que un ping defectuoso no lance el marcador lejos. */
const VELOCIDAD_MAX_MS = 70
const INTERVALO_MIN_MS = 1000
const INTERVALO_MAX_MS = 20000
/** Corrección suave hacia la posición estimada: con esto no se ven los ajustes. */
const SUAVIZADO_POSICION_MS = 500
const SUAVIZADO_RUMBO_MS = 700
/** Una diferencia mayor es un salto real (volvió la señal): se va directo, sin deslizar. */
const SALTO_DIRECTO_M = 300
const METROS_POR_GRADO = 111320

const aRad = (grados: number) => (grados * Math.PI) / 180

function rumboEntre(a: LatLng, b: LatLng): number {
  const dLng = aRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(aRad(b.lat))
  const x =
    Math.cos(aRad(a.lat)) * Math.sin(aRad(b.lat)) -
    Math.sin(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Diferencia con signo por el camino más corto, en (-180, 180]. */
function diferenciaAngular(desde: number, hasta: number): number {
  return ((hasta - desde + 540) % 360) - 180
}

function ubicarEnRuta(
  ruta: [number, number][],
  pos: LatLng,
  rumbo: number | null
): Seguimiento['enRuta'] {
  let mejor: Seguimiento['enRuta'] = null
  let mejorDist = DIST_MAX_RUTA_M
  for (let i = 0; i < ruta.length - 1; i++) {
    const [latA, lngA] = ruta[i]!
    const [latB, lngB] = ruta[i + 1]!
    const p = proyectarEnSegmento(pos.lat, pos.lng, latA, lngA, latB, lngB)
    const d = haversineDistanceM(pos.lat, pos.lng, p.lat, p.lng)
    if (d >= mejorDist) continue
    // En una ida y vuelta el mismo tramo aparece dos veces: el rumbo elige el sentido.
    if (rumbo != null) {
      const sentido = rumboEntre({ lat: latA, lng: lngA }, { lat: latB, lng: lngB })
      if (Math.abs(diferenciaAngular(rumbo, sentido)) > ANGULO_MAX_RUTA) continue
    }
    mejorDist = d
    mejor = { indice: i, lat: p.lat, lng: p.lng }
  }
  return mejor
}

/** Incorpora lo último que se sabe del integrante; solo un ping nuevo recalcula. */
export function actualizarSeguimiento(
  previo: Seguimiento | null,
  fix: LatLng & { rumbo: number | null; enMovimiento: boolean },
  ahora: number,
  ruta: [number, number][] | null
): Seguimiento {
  // La misma posición llega por socket, Realtime y snapshot: no es un ping nuevo.
  if (previo && previo.lat === fix.lat && previo.lng === fix.lng) {
    return { ...previo, rumbo: fix.rumbo ?? previo.rumbo, enMovimiento: fix.enMovimiento }
  }

  let velocidadMs = 0
  if (previo) {
    const intervalo = ahora - previo.recibidoEn
    if (intervalo >= INTERVALO_MIN_MS && intervalo <= INTERVALO_MAX_MS) {
      const medida =
        haversineDistanceM(previo.lat, previo.lng, fix.lat, fix.lng) / (intervalo / 1000)
      if (medida >= VELOCIDAD_MIN_MS && medida <= VELOCIDAD_MAX_MS) {
        velocidadMs = previo.velocidadMs > 0 ? (previo.velocidadMs + medida) / 2 : medida
      }
    }
  }

  return {
    lat: fix.lat,
    lng: fix.lng,
    recibidoEn: ahora,
    velocidadMs,
    rumbo: fix.rumbo,
    enMovimiento: fix.enMovimiento,
    enRuta: ruta && ruta.length > 1 ? ubicarEnRuta(ruta, fix, fix.rumbo) : null,
  }
}

function avanzarPorRuta(
  ruta: [number, number][],
  desde: LatLng & { indice: number },
  metros: number
): LatLng {
  let actual: LatLng = { lat: desde.lat, lng: desde.lng }
  let restante = metros
  for (let i = desde.indice + 1; i < ruta.length; i++) {
    const [lat, lng] = ruta[i]!
    const tramo = haversineDistanceM(actual.lat, actual.lng, lat, lng)
    if (tramo >= restante) {
      const t = tramo > 0 ? restante / tramo : 0
      return { lat: actual.lat + (lat - actual.lat) * t, lng: actual.lng + (lng - actual.lng) * t }
    }
    restante -= tramo
    actual = { lat, lng }
  }
  return actual
}

function avanzarEnLinea(desde: LatLng, rumbo: number, metros: number): LatLng {
  const r = aRad(rumbo)
  return {
    lat: desde.lat + (metros * Math.cos(r)) / METROS_POR_GRADO,
    lng: desde.lng + (metros * Math.sin(r)) / (METROS_POR_GRADO * Math.cos(aRad(desde.lat))),
  }
}

/**
 * Dónde debería verse el integrante ahora: sobre la ruta planificada si la está
 * siguiendo; si no, en línea recta según su rumbo. Detenido, sin señal o sin datos
 * para estimar, es la última posición real.
 */
export function posicionEstimada(
  s: Seguimiento,
  ahora: number,
  ruta: [number, number][] | null
): LatLng {
  const real = { lat: s.lat, lng: s.lng }
  const transcurrido = ahora - s.recibidoEn
  if (!s.enMovimiento || s.velocidadMs <= 0 || transcurrido > VENCIMIENTO_MS) return real

  const metros = (s.velocidadMs * Math.min(transcurrido, HORIZONTE_MS)) / 1000
  if (s.enRuta && ruta) return avanzarPorRuta(ruta, s.enRuta, metros)
  if (s.rumbo != null) return avanzarEnLinea(real, s.rumbo, metros)
  return real
}

const fraccionSuavizado = (dtMs: number, constanteMs: number) => 1 - Math.exp(-dtMs / constanteMs)

/** Acerca lo dibujado a lo estimado; cuando llega el ping real, el ajuste se ve como un deslizamiento. */
export function acercarPosicion(actual: LatLng, objetivo: LatLng, dtMs: number): LatLng {
  if (haversineDistanceM(actual.lat, actual.lng, objetivo.lat, objetivo.lng) > SALTO_DIRECTO_M) {
    return objetivo
  }
  const f = fraccionSuavizado(dtMs, SUAVIZADO_POSICION_MS)
  return {
    lat: actual.lat + (objetivo.lat - actual.lat) * f,
    lng: actual.lng + (objetivo.lng - actual.lng) * f,
  }
}

/** Gira por el camino más corto, sin dar la vuelta entera al cruzar el norte. */
export function acercarAngulo(actual: number, objetivo: number, dtMs: number): number {
  const paso = diferenciaAngular(actual, objetivo) * fraccionSuavizado(dtMs, SUAVIZADO_RUMBO_MS)
  return (actual + paso + 360) % 360
}
