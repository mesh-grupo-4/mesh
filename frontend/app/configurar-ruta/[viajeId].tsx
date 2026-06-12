import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { RouteBottomSheet } from '@/components/route-config/RouteBottomSheet'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import type { MapStyleId } from '@/components/route-config/mapStyles'
import { RouteMapView } from '@/components/route-config/RouteMapView'
import { useRoutePlanner } from '@/components/route-config/useRoutePlanner'
import { parametrosPorActividad } from '@/lib/activityDefaults'
import { DEV_USER_ID } from '@/constants/Config'
import { obtenerViaje, type TipoActividadApi } from '@/lib/viajesApi'

export default function ConfigurarRutaScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return raw?.trim() || DEV_USER_ID
  }, [params.userId])

  const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>('bici')
  const [velocidadEsperada, setVelocidadEsperada] = useState(35)
  const [distanciaMaxSeparacion, setDistanciaMaxSeparacion] = useState(300)
  const [cargandoViaje, setCargandoViaje] = useState(true)
  const [mapStyle, setMapStyle] = useState<MapStyleId>('standard')

  useEffect(() => {
    let cancel = false
    async function run() {
      if (!viajeId || !userId) {
        setCargandoViaje(false)
        return
      }
      try {
        const viaje = await obtenerViaje(viajeId, userId)
        if (!cancel) {
          const tipo = viaje.tipo_actividad as TipoActividadApi
          setTipoActividad(tipo)
          setVelocidadEsperada(viaje.velocidad_esperada)
          setDistanciaMaxSeparacion(viaje.distancia_max_separacion)
        }
      } catch {
        if (!cancel) {
          const fallback = parametrosPorActividad('bici')
          setVelocidadEsperada(fallback.velocidadEsperada)
          setDistanciaMaxSeparacion(fallback.distanciaMaxSeparacion)
        }
      } finally {
        if (!cancel) setCargandoViaje(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [viajeId, userId])

  const onSaved = useCallback(() => {
    router.back()
  }, [router])

  const {
    origen,
    destino,
    paradas,
    regionInicial,
    cameraTarget,
    setCameraTarget,
    routeLineLatLng,
    waypointsConCoords,
    calculando,
    errorRuta,
    resumenDistancia,
    resumenTiempo,
    confirmarHabilitado,
    guardando,
    actualizarWaypoint,
    agregarParada,
    eliminarParada,
    moverParada,
    guardar,
  } = useRoutePlanner({
    viajeId: viajeId ?? '',
    userId,
    tipoActividad,
    onSaved,
  })

  const onCameraTargetApplied = useCallback(() => {
    setCameraTarget(null)
  }, [setCameraTarget])

  if (cargandoViaje) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <RouteMapView
          waypoints={waypointsConCoords}
          routeLineLatLng={routeLineLatLng}
          mapStyle={mapStyle}
          initialRegion={regionInicial}
          cameraTarget={cameraTarget}
          onCameraTargetApplied={onCameraTargetApplied}
        />

        <MapStylePicker value={mapStyle} onChange={setMapStyle} />

        <RouteBottomSheet
          origen={origen}
          destino={destino}
          paradas={paradas}
          tipoActividad={tipoActividad}
          velocidadEsperada={velocidadEsperada}
          distanciaMaxSeparacion={distanciaMaxSeparacion}
          calculando={calculando}
          errorRuta={errorRuta}
          resumenDistancia={resumenDistancia}
          resumenTiempo={resumenTiempo}
          confirmarHabilitado={confirmarHabilitado}
          guardando={guardando}
          onUpdateWaypoint={actualizarWaypoint}
          onAgregarParada={agregarParada}
          onEliminarParada={eliminarParada}
          onMoverParada={moverParada}
          onGuardar={() => void guardar()}
        />
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e5e7eb' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
})
