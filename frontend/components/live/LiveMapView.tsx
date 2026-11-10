import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import Colors from '@/constants/Colors'
import { getMapStyle, type MapStyleId } from '@/components/route-config/mapStyles'
import { PinMarker, PIN_ANCHOR } from '@/components/maps/PinMarker'
import {
  DURACION_ANIMACION_MS,
  MeshMapView,
  SOPORTA_MARCADOR_PLANO,
  zoomFromLatDelta,
  type MovimientoMarcador,
  type PolylineSpec,
  type MeshMapViewHandle,
  type MarkerSpec,
} from '@/components/maps/MeshMapView'
import type { MemberLocation } from '@/hooks/useLiveLocations'
import type { AlertaApi } from '@/lib/alertasApi'
import {
  acercarAngulo,
  acercarPosicion,
  actualizarSeguimiento,
  posicionEstimada,
  type Seguimiento,
} from '@/lib/geo/movimientoVisual'

import { AlertMarker, alertMarkerKey, alertMarkerPopup } from './AlertMarker'
import { GHOST_TRAIL_COLOR, GhostMarker } from './GhostMarker'
import { MemberMarker, memberMarkerKey } from './MemberMarker'
import { mostrarRumbo, RumboMarker, rumboColor, rumboEnPasos } from './RumboMarker'
import { ParadaMarker, paradaMarkerPopup } from './ParadaMarker'
import type { CategoriaParadaApi } from '@/lib/paradasApi'
import { motivoParadaLegible } from '@/lib/paradasApi'

/** Zoom con el que se centra el mapa en tu posición al entrar. */
const ZOOM_INICIAL = 17
const COLOR_GUIA_LUGAR = '#0e7490'
/** Naranja de la app: el recorrido tiene que leerse claro sobre cualquier capa, también de noche. */
const COLOR_RECORRIDO = Colors.light.accent
const ANCHO_RECORRIDO = 7

/** Cadencia de tu marcador y de la cámara. */
const TICK_MOVIMIENTO_MS = 100
/** Los demás integrantes se reparten un presupuesto fijo de comandos al mapa nativo. */
const MS_POR_INTEGRANTE = 10
/** Debajo de este cambio (≈ 0,3 m) no vale la pena mandar nada al mapa. */
const UMBRAL_MOVIMIENTO_GRADOS = 0.000003
const UMBRAL_GIRO_GRADOS = 0.2
/** Cada cuánto se estira la punta de la traza hasta tu marcador. */
const COLA_CADA_MS = 500
const COLA_MIN_GRADOS = 0.00005

export type LiveMapViewHandle = {
  focusOnCoordinate: (lat: number, lng: number) => void
  fitBoundsToCoords: (coords: [number, number][]) => void
  /** Recentra sin tocar el zoom y orienta el mapa hacia donde vas. */
  panTo: (lat: number, lng: number) => void
}

type GuiaDestino = {
  coords: [number, number][]
  destino: { lat: number; lng: number; nombre: string; categoria?: CategoriaParadaApi | null }
  color?: string
}

type Props = {
  routeRemaining: [number, number][] | null
  /** Traza propia recorrida, cortada en tramos cuando hubo un salto/hueco de señal. */
  breadcrumb: [number, number][][] | null
  members: MemberLocation[]
  /** Alertas activas con ubicación — p. ej. desvíos detectados por el motor (RN-034). */
  alertasEnMapa?: AlertaApi[]
  guiaParada?: GuiaDestino | null
  guiaAlerta?: GuiaDestino | null
  /** Guía hacia un lugar elegido en "Cerca mío" (Google Places). */
  guiaLugar?: GuiaDestino | null
  /** RN-073: fantasma animado y su recorrido completo. */
  fantasma?: { lat: number; lng: number; nombre: string; pausado: boolean; traza: [number, number][] } | null
  currentUserId: string
  initialCenter: { latitude: number; longitude: number } | null
  mapStyle: MapStyleId
  /** El usuario arrastró el mapa a mano — señal para pausar el modo "seguirme". */
  onUserDrag?: () => void
  /** Solo pantalla en vivo: entre pings los marcadores avanzan en vez de saltar. */
  movimientoFluido?: boolean
  /** Ruta planificada completa: los marcadores estimados avanzan sobre ella. */
  rutaCompleta?: [number, number][] | null
  /** Con `movimientoFluido`: la cámara te sigue y gira hacia donde vas. */
  siguiendo?: boolean
  /** false = mapa de solo lectura (sin arrastre ni zoom), p. ej. una miniatura. */
  interactive?: boolean
  onReady?: () => void
}

export const LiveMapView = forwardRef<LiveMapViewHandle, Props>(function LiveMapView(
  {
    routeRemaining,
    breadcrumb,
    members,
    alertasEnMapa = [],
    guiaParada = null,
    guiaAlerta = null,
    guiaLugar = null,
    fantasma = null,
    currentUserId,
    initialCenter,
    mapStyle,
    onUserDrag,
    movimientoFluido = false,
    rutaCompleta = null,
    siguiendo = false,
    interactive = true,
    onReady,
  },
  ref
) {
  const mapRef = useRef<MeshMapViewHandle>(null)
  const capa = getMapStyle(mapStyle)
  const centeredOnce = useRef(false)
  const [mapaListo, setMapaListo] = useState(false)
  /** Tramo entre el último ping y tu marcador, para que la traza no quede atrás. */
  const [cola, setCola] = useState<[number, number][] | null>(null)

  const seguimientos = useRef(new Map<string, Seguimiento>())
  const dibujadas = useRef(new Map<string, { lat: number; lng: number }>())
  const orientacionRef = useRef<number | null>(null)
  const pausaCamaraRef = useRef(0)
  const ultimaCamaraRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null)

  // El bucle de movimiento lee lo último sin tener que reiniciarse.
  const siguiendoRef = useRef(siguiendo)
  siguiendoRef.current = siguiendo
  const rutaRef = useRef(rutaCompleta)
  rutaRef.current = rutaCompleta
  const finTrazaRef = useRef<[number, number] | null>(null)
  finTrazaRef.current = breadcrumb?.at(-1)?.at(-1) ?? null
  const periodoRestoRef = useRef(TICK_MOVIMIENTO_MS)
  periodoRestoRef.current = Math.max(TICK_MOVIMIENTO_MS, members.length * MS_POR_INTEGRANTE)

  useImperativeHandle(ref, () => ({
    focusOnCoordinate(lat, lng) {
      mapRef.current?.animateTo({ latitude: lat, longitude: lng }, 15)
    },
    fitBoundsToCoords(coords) {
      if (coords.length < 2) return
      mapRef.current?.fitBounds(
        coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      )
    },
    panTo(lat, lng) {
      const rumbo = SOPORTA_MARCADOR_PLANO ? (seguimientos.current.get(currentUserId)?.rumbo ?? null) : null
      if (rumbo != null) orientacionRef.current = rumbo
      const pos = dibujadas.current.get(currentUserId) ?? { lat, lng }
      // Deja terminar la animación: el seguimiento continuo la cortaría de golpe.
      pausaCamaraRef.current = Date.now() + DURACION_ANIMACION_MS + 50
      mapRef.current?.panTo({ latitude: pos.lat, longitude: pos.lng }, rumbo ?? undefined)
    },
  }))

  // Espera a que el mapa esté listo: antes de eso se descarta el animateTo
  // y el mapa quedaba con el zoom alejado del arranque.
  useEffect(() => {
    if (!initialCenter || !mapaListo || centeredOnce.current) return
    centeredOnce.current = true
    pausaCamaraRef.current = Date.now() + DURACION_ANIMACION_MS + 50
    mapRef.current?.animateTo(initialCenter, ZOOM_INICIAL)
  }, [initialCenter, mapaListo])

  // Cada ping (real) reinicia la estimación de ese integrante.
  useEffect(() => {
    if (!movimientoFluido) return
    const ahora = Date.now()
    const presentes = new Set<string>()
    for (const m of members) {
      presentes.add(m.usuarioId)
      seguimientos.current.set(
        m.usuarioId,
        actualizarSeguimiento(
          seguimientos.current.get(m.usuarioId) ?? null,
          {
            lat: m.lat,
            lng: m.lng,
            rumbo: m.rumbo,
            enMovimiento: m.estado === 'en_movimiento' && !m.isStale,
          },
          ahora,
          rutaRef.current
        )
      )
    }
    for (const id of seguimientos.current.keys()) {
      if (presentes.has(id)) continue
      seguimientos.current.delete(id)
      dibujadas.current.delete(id)
    }
  }, [members, movimientoFluido])

  // Bucle de dibujo: mueve marcadores y cámara directo en el mapa nativo, sin
  // renderizar React. Tu marcador va siempre a tope; el resto, según cuántos sean.
  useEffect(() => {
    if (!movimientoFluido) return
    let ultimoPropio = Date.now()
    let ultimoResto = ultimoPropio
    let ultimaCola = 0

    const moverCamara = (
      rumbo: number | null,
      pos: { lat: number; lng: number },
      ahora: number,
      dt: number
    ) => {
      if (!siguiendoRef.current || ahora < pausaCamaraRef.current) return
      const objetivo = SOPORTA_MARCADOR_PLANO ? rumbo : null
      const center = { latitude: pos.lat, longitude: pos.lng }

      if (objetivo != null && orientacionRef.current == null) {
        // Primer rumbo conocido: gira animando en vez de pegar el salto.
        orientacionRef.current = objetivo
        pausaCamaraRef.current = ahora + DURACION_ANIMACION_MS + 50
        mapRef.current?.panTo(center, objetivo)
        return
      }
      if (objetivo != null && orientacionRef.current != null) {
        orientacionRef.current = acercarAngulo(orientacionRef.current, objetivo, dt)
      }

      const heading = orientacionRef.current
      const previa = ultimaCamaraRef.current
      if (
        previa &&
        Math.abs(previa.lat - pos.lat) + Math.abs(previa.lng - pos.lng) < UMBRAL_MOVIMIENTO_GRADOS &&
        (heading == null || previa.heading == null || Math.abs(previa.heading - heading) < UMBRAL_GIRO_GRADOS)
      ) {
        return
      }
      ultimaCamaraRef.current = { lat: pos.lat, lng: pos.lng, heading }
      mapRef.current?.seguir(center, heading ?? undefined)
    }

    const tick = () => {
      const ahora = Date.now()
      const dtPropio = ahora - ultimoPropio
      ultimoPropio = ahora
      const dtResto = ahora - ultimoResto
      const tocaResto = dtResto >= periodoRestoRef.current
      if (tocaResto) ultimoResto = ahora

      const cambios: MovimientoMarcador[] = []
      for (const [id, seguimiento] of seguimientos.current) {
        const esYo = id === currentUserId
        if (!esYo && !tocaResto) continue
        const objetivo = posicionEstimada(seguimiento, ahora, rutaRef.current)
        const actual = dibujadas.current.get(id)
        const siguiente = actual ? acercarPosicion(actual, objetivo, esYo ? dtPropio : dtResto) : objetivo
        dibujadas.current.set(id, siguiente)
        if (
          actual &&
          Math.abs(actual.lat - siguiente.lat) + Math.abs(actual.lng - siguiente.lng) < UMBRAL_MOVIMIENTO_GRADOS
        ) {
          continue
        }
        cambios.push({ id, ...siguiente }, { id: `rumbo-${id}`, ...siguiente })
      }
      if (cambios.length > 0) mapRef.current?.moverMarcadores(cambios)

      const yo = seguimientos.current.get(currentUserId)
      const posYo = dibujadas.current.get(currentUserId)
      if (!yo || !posYo) return
      moverCamara(yo.rumbo, posYo, ahora, dtPropio)

      if (ahora - ultimaCola >= COLA_CADA_MS) {
        ultimaCola = ahora
        const fin = finTrazaRef.current
        const separados =
          fin != null && Math.abs(fin[0] - posYo.lat) + Math.abs(fin[1] - posYo.lng) > COLA_MIN_GRADOS
        setCola(fin && separados ? [fin, [posYo.lat, posYo.lng]] : null)
      }
    }

    const id = setInterval(tick, TICK_MOVIMIENTO_MS)
    return () => clearInterval(id)
  }, [movimientoFluido, currentUserId])

  const fallbackCenter = initialCenter ?? { latitude: -31.4167, longitude: -64.1833 }
  const fallbackZoom = zoomFromLatDelta(initialCenter ? 0.04 : 0.08)

  const markers = useMemo<MarkerSpec[]>(() => {
    const integrantes: MarkerSpec[] = members.map((m) => ({
      id: m.usuarioId,
      lat: m.lat,
      lng: m.lng,
      content: <MemberMarker member={m} isMe={m.usuarioId === currentUserId} />,
      contentKey: memberMarkerKey({ member: m, isMe: m.usuarioId === currentUserId }),
      zIndex: m.usuarioId === currentUserId ? 1000 : 1,
      posicionDibujada: () => dibujadas.current.get(m.usuarioId),
    }))

    // Flecha de rumbo de cada integrante en movimiento, justo debajo de su avatar.
    // Marcador plano: apunta bien respecto del mapa aunque el mapa esté girado.
    const rumbos: MarkerSpec[] = members.filter(mostrarRumbo).map((m) => {
      const isMe = m.usuarioId === currentUserId
      const color = rumboColor(m, isMe)
      const giro = rumboEnPasos(m.rumbo)
      return {
        id: `rumbo-${m.usuarioId}`,
        lat: m.lat,
        lng: m.lng,
        zIndex: isMe ? 999 : 0,
        content: <RumboMarker color={color} giro={giro} />,
        contentKey: `${color}|${giro}`,
        flat: true,
        posicionDibujada: () => dibujadas.current.get(m.usuarioId),
      }
    })

    const alertas: MarkerSpec[] = alertasEnMapa
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({
        id: `alerta-${a.id}`,
        lat: a.lat!,
        lng: a.lng!,
        content: <AlertMarker alerta={a} />,
        contentKey: alertMarkerKey(a),
        zIndex: 500,
        popup: alertMarkerPopup(a),
      }))

    const paradaGuia: MarkerSpec[] = guiaParada
      ? [
          {
            id: `parada-guia-${guiaParada.destino.lat}-${guiaParada.destino.lng}`,
            lat: guiaParada.destino.lat,
            lng: guiaParada.destino.lng,
            content: <ParadaMarker />,
            contentKey: 'parada',
            zIndex: 600,
            popup: paradaMarkerPopup(
              guiaParada.destino.nombre,
              motivoParadaLegible(guiaParada.destino.categoria ?? null)
            ),
          },
        ]
      : []

    const alertaGuia: MarkerSpec[] = guiaAlerta
      ? [
          {
            id: `alerta-guia-${guiaAlerta.destino.lat}-${guiaAlerta.destino.lng}`,
            lat: guiaAlerta.destino.lat,
            lng: guiaAlerta.destino.lng,
            content: <ParadaMarker />,
            contentKey: 'parada',
            zIndex: 650,
            popup: paradaMarkerPopup(guiaAlerta.destino.nombre, 'Punto de parada'),
          },
        ]
      : []

    const lugarGuia: MarkerSpec[] = guiaLugar
      ? [
          {
            id: `lugar-guia-${guiaLugar.destino.lat}-${guiaLugar.destino.lng}`,
            lat: guiaLugar.destino.lat,
            lng: guiaLugar.destino.lng,
            content: <PinMarker color={guiaLugar.color ?? COLOR_GUIA_LUGAR} />,
            contentKey: guiaLugar.color ?? COLOR_GUIA_LUGAR,
            anchor: PIN_ANCHOR,
            zIndex: 640,
            popup: { title: guiaLugar.destino.nombre },
          },
        ]
      : []

    const ghost: MarkerSpec[] = fantasma
      ? [
          {
            id: 'fantasma',
            lat: fantasma.lat,
            lng: fantasma.lng,
            content: <GhostMarker pausado={fantasma.pausado} />,
            contentKey: fantasma.pausado ? 'pausado' : 'activo',
            zIndex: 900,
            popup: { title: `Fantasma: ${fantasma.nombre}` },
          },
        ]
      : []

    return [
      ...alertaGuia,
      ...paradaGuia,
      ...lugarGuia,
      ...alertas,
      ...ghost,
      ...rumbos,
      ...integrantes,
    ]
  }, [members, alertasEnMapa, guiaParada, guiaAlerta, guiaLugar, fantasma, currentUserId])

  const polylinesBase = useMemo((): PolylineSpec[] => {
    const list: PolylineSpec[] = []
    if (breadcrumb) {
      for (const segmento of breadcrumb) {
        if (segmento.length < 2) continue
        list.push({
          coords: segmento,
          color: COLOR_RECORRIDO,
          width: ANCHO_RECORRIDO,
          opacity: 1,
        })
      }
    }
    if (routeRemaining && routeRemaining.length > 1) {
      list.push({
        coords: routeRemaining,
        color: COLOR_RECORRIDO,
        width: ANCHO_RECORRIDO,
        opacity: 1,
      })
    }
    if (guiaParada && guiaParada.coords.length > 1) {
      list.push({
        coords: guiaParada.coords,
        color: guiaParada.color ?? '#f59e0b',
        width: 6,
        opacity: 0.95,
      })
    }
    if (guiaAlerta && guiaAlerta.coords.length > 1) {
      list.push({
        coords: guiaAlerta.coords,
        color: guiaAlerta.color ?? '#4338ca',
        width: 6,
        opacity: 0.95,
      })
    }
    if (guiaLugar && guiaLugar.coords.length > 1) {
      list.push({
        coords: guiaLugar.coords,
        color: guiaLugar.color ?? COLOR_GUIA_LUGAR,
        width: 6,
        opacity: 0.95,
      })
    }
    if (fantasma && fantasma.traza.length > 1) {
      list.push({ coords: fantasma.traza, color: GHOST_TRAIL_COLOR, width: 3, opacity: 0.35 })
    }
    return list
  }, [breadcrumb, routeRemaining, guiaParada, guiaAlerta, guiaLugar, fantasma])

  // Va al final y aparte: así, cuando solo cambia la punta, no se redibuja el resto.
  const polylines = useMemo(
    () =>
      cola
        ? [...polylinesBase, { coords: cola, color: COLOR_RECORRIDO, width: ANCHO_RECORRIDO, opacity: 1 }]
        : polylinesBase,
    [polylinesBase, cola]
  )

  return (
    <View style={styles.container}>
      <MeshMapView
        ref={mapRef}
        initialCenter={fallbackCenter}
        initialZoom={fallbackZoom}
        mapStyle={capa}
        markers={markers}
        polylines={polylines}
        onUserDrag={onUserDrag}
        interactive={interactive}
        onReady={() => {
          setMapaListo(true)
          onReady?.()
        }}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
