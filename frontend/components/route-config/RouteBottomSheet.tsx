import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ElementRef } from 'react'
import { ActivityIndicator, Keyboard, Platform, StyleSheet, Text, View } from 'react-native'

import { ActivityTile, Btn, useTheme } from '@/components/MeshUI'
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
  const theme = useTheme()
  const snapPoints = useMemo(() => ['18%', '48%', '88%'], [])
  const sheetRef = useRef<BottomSheet>(null)
  const scrollRef = useRef<ElementRef<typeof BottomSheetScrollView>>(null)
  const rowOffsetsRef = useRef<Map<string, number>>(new Map())
  const sugerenciasAbiertas = useRef(new Set<string>())
  const [scrollSheetHabilitado, setScrollSheetHabilitado] = useState(true)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const onInputFocus = useCallback((waypointId: string) => {
    sheetRef.current?.snapToIndex(2)
    const y = rowOffsetsRef.current.get(waypointId)
    if (y == null) return
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true })
    }, Platform.OS === 'ios' ? 80 : 120)
  }, [])

  const renderRow = (waypoint: RouteWaypoint, stopIndex?: number, isLast = false) => (
    <View
      key={waypoint.id}
      style={styles.timelineRow}
      onLayout={(e) => rowOffsetsRef.current.set(waypoint.id, e.nativeEvent.layout.y)}
    >
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
        onInputFocus={() => onInputFocus(waypoint.id)}
        onPickOnMap={() => onPickOnMap(waypoint.id)}
        mapPickMode={mapPickMode}
        InputComponent={BottomSheetTextInput}
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
      backgroundStyle={{ backgroundColor: theme.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.textMute, width: 40 }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableContentPanningGesture={!mapPickMode}
    >
      <BottomSheetScrollView
        ref={scrollRef}
        scrollEnabled={scrollSheetHabilitado && !mapPickMode}
        contentContainerStyle={[
          styles.content,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + (Platform.OS === 'ios' ? 24 : 16) },
        ]}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        <Text style={[styles.title, { color: theme.text }]}>Planificá tu ruta</Text>
        <Text style={[styles.subtitle, { color: theme.textDim }]}>Origen, paradas y destino</Text>

        <View
          style={[
            styles.activityBanner,
            { backgroundColor: theme.accentWeak, borderColor: theme.accentLine },
          ]}
        >
          <ActivityTile activity={tipoActividad} size={40} />
          <View style={styles.activityBannerText}>
            <Text style={[styles.activityBannerTitle, { color: theme.text }]}>
              {etiquetaActividad(tipoActividad)}
            </Text>
            <Text style={[styles.activityBannerParams, { color: theme.textDim }]}>
              {velocidadEsperada} km/h · alerta a {sepTexto} de separación
            </Text>
            <Text style={[styles.activityBannerHint, { color: theme.textMute }]}>
              {textoPerfilRuta(tipoActividad)}
            </Text>
          </View>
        </View>

        {renderRow(origen)}

        {paradas.map((p, i) => renderRow(p, i))}

        <View style={styles.addStopWrap}>
          <Btn
            variant="outline"
            size="sm"
            icon="plus"
            onPress={onAgregarParada}
            disabled={mapPickMode}
          >
            Agregar parada
          </Btn>
        </View>

        {renderRow(destino, undefined, true)}

        <View
          style={[
            styles.resumen,
            { backgroundColor: theme.surface2, borderColor: theme.border },
          ]}
        >
          {calculando ? (
            <View style={styles.calculandoRow}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.muted, { color: theme.textDim }]}>Calculando ruta…</Text>
            </View>
          ) : errorRuta ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>{errorRuta}</Text>
          ) : resumenDistancia && resumenTiempo ? (
            <>
              <Text style={[styles.resumenStrong, { color: theme.text }]}>
                Distancia: {resumenDistancia}
              </Text>
              <Text style={[styles.resumenTxt, { color: theme.textDim }]}>
                Tiempo estimado: {resumenTiempo}
              </Text>
            </>
          ) : (
            <Text style={[styles.muted, { color: theme.textDim }]}>
              Definí origen y destino para ver el resumen.
            </Text>
          )}
        </View>

        <Btn
          block
          size="lg"
          icon="check"
          disabled={!confirmarHabilitado}
          loading={guardando}
          onPress={onGuardar}
          style={styles.saveBtn}
        >
          Guardar ruta
        </Btn>
      </BottomSheetScrollView>
    </BottomSheet>
  )
})

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityBannerText: { flex: 1, gap: 2 },
  activityBannerTitle: { fontSize: 16, fontWeight: '700' },
  activityBannerParams: { fontSize: 14, marginTop: 2 },
  activityBannerHint: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  addStopWrap: {
    marginLeft: 30,
    marginVertical: 8,
    alignSelf: 'flex-start',
  },
  resumen: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  calculandoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumenStrong: { fontSize: 17, fontWeight: '700' },
  resumenTxt: { marginTop: 4, fontSize: 15 },
  muted: { fontSize: 14 },
  errorText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { marginTop: 16 },
})
