import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ActivityTile } from '@/components/MeshUI'
import {
  etiquetaActividad,
  textoPerfilRuta,
} from '@/lib/activityDefaults'
import type { TipoActividadApi } from '@/lib/viajesApi'

import { RouteTimelineConnector } from './RouteTimelineConnector'
import { RouteWaypointRow } from './RouteWaypointRow'
import type { RouteWaypoint } from './routeTypes'
import type { RouteBottomSheetHandle } from './useRoutePlanner'

type Props = {
  origen: RouteWaypoint
  destino: RouteWaypoint
  paradas: RouteWaypoint[]
  tipoActividad: TipoActividadApi
  velocidadEsperada: number
  distanciaMaxSeparacion: number
  calculando: boolean
  errorRuta: string | null
  resumenDistancia: string | null
  resumenTiempo: string | null
  confirmarHabilitado: boolean
  guardando: boolean
  mapPickMode: boolean
  onUpdateWaypoint: (
    id: string,
    patch: Partial<Pick<RouteWaypoint, 'lat' | 'lon' | 'name' | 'category'>>
  ) => void
  onAgregarParada: () => void
  onEliminarParada: (id: string) => void
  onMoverParada: (id: string, dir: 'up' | 'down') => void
  onPickOnMap: (waypointId: string) => void
  onGuardar: () => void
}

export const RouteBottomSheet = forwardRef<RouteBottomSheetHandle, Props>(function RouteBottomSheet(
  {
    origen,
    destino,
    paradas,
    tipoActividad,
    velocidadEsperada,
    distanciaMaxSeparacion,
    calculando,
    errorRuta,
    resumenDistancia,
    resumenTiempo,
    confirmarHabilitado,
    guardando,
    mapPickMode,
    onUpdateWaypoint,
    onAgregarParada,
    onEliminarParada,
    onMoverParada,
    onPickOnMap,
    onGuardar,
  },
  ref
) {
  const snapPoints = useMemo(() => ['18%', '48%', '88%'], [])
  const sheetRef = useRef<BottomSheet>(null)
  const sugerenciasAbiertas = useRef(new Set<string>())
  const [scrollSheetHabilitado, setScrollSheetHabilitado] = useState(true)

  useImperativeHandle(ref, () => ({
    snapToMin() {
      sheetRef.current?.snapToIndex(0)
    },
    snapToDefault() {
      sheetRef.current?.snapToIndex(1)
    },
  }))

  const onSuggestionsOpenChange = useCallback((waypointId: string, open: boolean) => {
    if (open) {
      sugerenciasAbiertas.current.add(waypointId)
    } else {
      sugerenciasAbiertas.current.delete(waypointId)
    }
    const haySugerencias = sugerenciasAbiertas.current.size > 0
    setScrollSheetHabilitado(!haySugerencias)
    if (haySugerencias) {
      sheetRef.current?.snapToIndex(2)
    }
  }, [])

  const renderRow = (waypoint: RouteWaypoint, stopIndex?: number, isLast = false) => (
    <View key={waypoint.id} style={styles.timelineRow}>
      <RouteTimelineConnector type={waypoint.type} isLast={isLast} />
      <RouteWaypointRow
        waypoint={waypoint}
        stopIndex={stopIndex}
        onUpdate={onUpdateWaypoint}
        onRemove={waypoint.type === 'STOP' ? onEliminarParada : undefined}
        onMoveUp={waypoint.type === 'STOP' ? (id) => onMoverParada(id, 'up') : undefined}
        onMoveDown={waypoint.type === 'STOP' ? (id) => onMoverParada(id, 'down') : undefined}
        canMoveUp={waypoint.type === 'STOP' && (stopIndex ?? 0) > 0}
        canMoveDown={waypoint.type === 'STOP' && (stopIndex ?? 0) < paradas.length - 1}
        onSuggestionsOpenChange={(open) => onSuggestionsOpenChange(waypoint.id, open)}
        onPickOnMap={() => onPickOnMap(waypoint.id)}
        mapPickMode={mapPickMode}
      />
    </View>
  )

  const sepTexto =
    distanciaMaxSeparacion >= 1000
      ? `${distanciaMaxSeparacion / 1000} km`
      : `${distanciaMaxSeparacion} m`

  return (
    <BottomSheet
      ref={sheetRef}
      index={1}
      snapPoints={snapPoints}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableContentPanningGesture={!mapPickMode}
    >
      <BottomSheetScrollView
        scrollEnabled={scrollSheetHabilitado && !mapPickMode}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        <Text style={styles.title}>Planificá tu ruta</Text>
        <Text style={styles.subtitle}>Origen, paradas y destino</Text>

        <View style={styles.activityBanner}>
          <ActivityTile activity={tipoActividad} size={40} />
          <View style={styles.activityBannerText}>
            <Text style={styles.activityBannerTitle}>{etiquetaActividad(tipoActividad)}</Text>
            <Text style={styles.activityBannerParams}>
              {velocidadEsperada} km/h · alerta a {sepTexto} de separación
            </Text>
            <Text style={styles.activityBannerHint}>{textoPerfilRuta(tipoActividad)}</Text>
          </View>
        </View>

        {renderRow(origen)}

        {paradas.map((p, i) => renderRow(p, i))}

        <Pressable style={styles.addStopBtn} onPress={onAgregarParada} disabled={mapPickMode}>
          <Text style={styles.addStopTxt}>+ Agregar parada</Text>
        </Pressable>

        {renderRow(destino, undefined, true)}

        <View style={styles.resumen}>
          {calculando ? (
            <View style={styles.calculandoRow}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.muted}>Calculando ruta…</Text>
            </View>
          ) : errorRuta ? (
            <Text style={styles.errorText}>{errorRuta}</Text>
          ) : resumenDistancia && resumenTiempo ? (
            <>
              <Text style={styles.resumenStrong}>Distancia: {resumenDistancia}</Text>
              <Text style={styles.resumenTxt}>Tiempo estimado: {resumenTiempo}</Text>
            </>
          ) : (
            <Text style={styles.muted}>Definí origen y destino para ver el resumen.</Text>
          )}
        </View>

        <Pressable
          style={[styles.btn, !confirmarHabilitado && styles.btnOff]}
          disabled={!confirmarHabilitado}
          onPress={onGuardar}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTxt}>Guardar ruta</Text>
          )}
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  )
})

const styles = StyleSheet.create({
  handle: { backgroundColor: '#9ca3af', width: 40 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activityBannerText: { flex: 1, gap: 2 },
  activityBannerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  activityBannerParams: { fontSize: 14, color: '#374151', marginTop: 2 },
  activityBannerHint: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  addStopBtn: {
    marginLeft: 30,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  addStopTxt: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  resumen: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calculandoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumenStrong: { fontSize: 17, fontWeight: '700', color: '#111827' },
  resumenTxt: { marginTop: 4, fontSize: 15, color: '#374151' },
  muted: { fontSize: 14, color: '#6b7280' },
  errorText: { fontSize: 15, color: '#b91c1c', fontWeight: '600' },
  btn: {
    marginTop: 16,
    backgroundColor: '#15803d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnOff: { backgroundColor: '#9ca3af' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
