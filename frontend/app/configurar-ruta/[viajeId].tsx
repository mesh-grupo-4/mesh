import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { TopBar, useTheme } from '@/components/MeshUI'
import { MapPickOverlay } from '@/components/route-config/MapPickOverlay'
import { RouteBottomSheet } from '@/components/route-config/RouteBottomSheet'
import { MapStylePicker } from '@/components/route-config/MapStylePicker'
import type { MapStyleId } from '@/components/route-config/mapStyles'
import { RouteMapView } from '@/components/route-config/RouteMapView'
import {
  useRoutePlanner,
  type RouteBottomSheetHandle,
} from '@/components/route-config/useRoutePlanner'
import { WaypointNameModal } from '@/components/route-config/WaypointNameModal'
import { useAuth } from '@/context/AuthContext'
import { parametrosPorActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { obtenerViaje, type TipoActividadApi } from '@/lib/viajesApi'

export default function ConfigurarRutaScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { backendUserId, backendSyncing } = useAuth()
  const params = useLocalSearchParams<{ viajeId: string | string[]; userId?: string | string[] }>()

  const viajeId = useMemo(() => {
    const v = params.viajeId
    return Array.isArray(v) ? v[0] : v
  }, [params.viajeId])

  const userId = useMemo(() => {
    const u = params.userId
    const raw = Array.isArray(u) ? u[0] : u
    return resolveBackendUserId(raw ?? backendUserId)
  }, [params.userId, backendUserId])

  const sheetRef = useRef<RouteBottomSheetHandle>(null)

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
    fitRouteCoords,
    routeLineLatLng,
    waypointsConCoords,
    calculando,
    cargandoRuta,
    errorRuta,
    resumenDistancia,
    resumenTiempo,
    confirmarHabilitado,
    guardando,
    modoSeleccionMapa,
    centroMapaPendiente,
    nameModalVisible,
    nameModalInitial,
    nameModalLoading,
    actualizarWaypoint,
    agregarParada,
    eliminarParada,
    moverParada,
    iniciarSeleccionMapa,
    cancelarSeleccionMapa,
    onRegionChangeComplete,
    confirmarCentroMapa,
    aplicarNombreMapa,
    cancelarNombreMapa,
    guardar,
  } = useRoutePlanner({
    viajeId: viajeId ?? '',
    userId,
    tipoActividad,
    onSaved,
    sheetRef,
  })

  const onCameraTargetApplied = useCallback(() => {
    setCameraTarget(null)
  }, [setCameraTarget])

  if (cargandoViaje || backendSyncing || cargandoRuta || !userId) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.mapBg }]}>
      <View style={styles.root}>
        <RouteMapView
          waypoints={waypointsConCoords}
          routeLineLatLng={routeLineLatLng}
          mapStyle={mapStyle}
          initialRegion={regionInicial}
          cameraTarget={cameraTarget}
          onCameraTargetApplied={onCameraTargetApplied}
          fitRouteCoords={fitRouteCoords}
          mapPickMode={Boolean(modoSeleccionMapa)}
          onRegionChangeComplete={onRegionChangeComplete}
          calculando={calculando}
        />

        {!modoSeleccionMapa ? (
          <View style={styles.header} pointerEvents="box-none">
            <View style={{ backgroundColor: theme.background }}>
              <TopBar
                title="Ruta y paradas"
                sub="Definí origen, paradas y destino"
                onBack={() => router.back()}
                bordered={false}
              />
            </View>
          </View>
        ) : null}

        {!modoSeleccionMapa ? <MapStylePicker value={mapStyle} onChange={setMapStyle} /> : null}

        {modoSeleccionMapa ? (
          <MapPickOverlay
            lat={centroMapaPendiente?.lat ?? null}
            lon={centroMapaPendiente?.lon ?? null}
            onConfirm={() => void confirmarCentroMapa()}
            onCancel={cancelarSeleccionMapa}
          />
        ) : null}

        <RouteBottomSheet
          ref={sheetRef}
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
          mapPickMode={Boolean(modoSeleccionMapa)}
          onUpdateWaypoint={actualizarWaypoint}
          onAgregarParada={agregarParada}
          onEliminarParada={eliminarParada}
          onMoverParada={moverParada}
          onPickOnMap={iniciarSeleccionMapa}
          onGuardar={() => void guardar()}
        />

        <WaypointNameModal
          visible={nameModalVisible}
          initialName={nameModalInitial}
          loadingName={nameModalLoading}
          onConfirm={aplicarNombreMapa}
          onCancel={cancelarNombreMapa}
        />
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
  },
})
