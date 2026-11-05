import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'

import { LiveMapView, type LiveMapViewHandle } from '@/components/live/LiveMapView'
import { useBreadcrumbTrail } from '@/hooks/useBreadcrumbTrail'
import { rowToMember, STALE_AFTER_MS, type MemberLocation } from '@/hooks/useLiveLocations'
import { dividirRutaPorAvance } from '@/lib/geo/routeProgress'
import { listarUbicacionesVivas } from '@/lib/viajesApi'

/** Es un vistazo del estado actual, no el mapa en vivo: alcanza con refrescar cada 15 s. */
const REFRESCO_MS = 15000

type Props = {
  viajeId: string
  userId: string
  tipoActividad: string
  /** Ruta planificada; null si el viaje arrancó sin recorrido. */
  routeLine: [number, number][] | null
  nameByUserId: Record<string, string>
  altura: number
}

/**
 * Miniatura de solo lectura de un viaje en curso: ruta restante, tu traza y la
 * última posición del grupo. Usa el snapshot REST de ubicaciones (mismo control
 * de privacidad RN-111 que el mapa en vivo) en lugar de suscribirse al tiempo
 * real, que ya lo hace la pantalla en vivo.
 */
export function MiniMapaEnCurso({
  viajeId,
  userId,
  tipoActividad,
  routeLine,
  nameByUserId,
  altura,
}: Props) {
  const mapRef = useRef<LiveMapViewHandle>(null)
  const [miembros, setMiembros] = useState<MemberLocation[]>([])
  const [mapaListo, setMapaListo] = useState(false)
  const namesRef = useRef(nameByUserId)
  namesRef.current = nameByUserId

  // Solo refresca mientras la pantalla está enfocada (no por debajo del mapa en vivo).
  useFocusEffect(
    useCallback(() => {
      if (!viajeId || !userId.trim()) return
      let cancelado = false
      const cargar = async () => {
        try {
          const rows = await listarUbicacionesVivas(viajeId, userId)
          if (cancelado) return
          const ahora = Date.now()
          setMiembros(
            rows.map((row) => {
              const m = rowToMember(row, namesRef.current)
              const ts = new Date(m.updatedAt).getTime()
              return { ...m, isStale: Number.isFinite(ts) ? ahora - ts > STALE_AFTER_MS : false }
            })
          )
        } catch {
          /* red intermitente: queda la última foto */
        }
      }
      void cargar()
      const id = setInterval(() => void cargar(), REFRESCO_MS)
      return () => {
        cancelado = true
        clearInterval(id)
      }
    }, [viajeId, userId])
  )

  const breadcrumb = useBreadcrumbTrail({ viajeId, userId, tipoActividad })

  const miPosicion = useMemo(() => {
    const yo = miembros.find((m) => m.usuarioId === userId)
    return yo ? { lat: yo.lat, lng: yo.lng } : null
  }, [miembros, userId])

  const routeRemaining = useMemo(() => {
    if (!routeLine || routeLine.length < 2) return null
    return miPosicion ? dividirRutaPorAvance(routeLine, miPosicion).restante : routeLine
  }, [routeLine, miPosicion])

  // Encuadra ruta, traza y grupo una sola vez, cuando el mapa está listo y hay
  // al menos dos puntos; con uno solo, centra ahí hasta que lleguen más.
  const encuadrado = useRef(false)
  useEffect(() => {
    if (!mapaListo || encuadrado.current) return
    const coords: [number, number][] = [
      ...(routeLine ?? []),
      ...breadcrumb.flat(),
      ...miembros.map((m): [number, number] => [m.lat, m.lng]),
    ]
    const [primero] = coords
    if (!primero) return
    if (coords.length === 1) {
      mapRef.current?.focusOnCoordinate(primero[0], primero[1])
      return
    }
    encuadrado.current = true
    mapRef.current?.fitBoundsToCoords(coords)
  }, [mapaListo, routeLine, breadcrumb, miembros])

  return (
    <View style={{ height: altura, width: '100%' }} pointerEvents="none">
      <LiveMapView
        ref={mapRef}
        routeRemaining={routeRemaining}
        breadcrumb={breadcrumb}
        members={miembros}
        currentUserId={userId}
        initialCenter={null}
        mapStyle="standard"
        interactive={false}
        onReady={() => setMapaListo(true)}
      />
    </View>
  )
}
