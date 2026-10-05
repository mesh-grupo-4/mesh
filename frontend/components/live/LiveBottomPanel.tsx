import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'
import { uiConfigPorActividad } from '@/lib/activityUi'
import type { TipoActividadApi } from '@/lib/viajesApi'

import { ParadaActionsBar } from './ParadaActionsBar'
import { TripMetricsPanel, type EntrenamientoEnVivo } from './TripMetricsPanel'

const HANDLE_HEIGHT = 20

type Props = {
  elapsedLabel: string
  distanceLabel: string
  /** RN-065: fila de ritmo/velocidad, solo en modo entrenamiento. */
  entrenamiento?: EntrenamientoEnVivo | null
  enCurso: boolean
  esLider: boolean
  accion: boolean
  paradaDesde: string | null
  esIncidenteDetectado?: boolean
  puedeSolicitar: boolean
  solicitudPendiente: boolean
  paradaEnCurso: boolean
  onDetenerse: () => void
  onRetomar: () => void
  onEstoyBien?: () => void
  onSolicitar: () => void
  onFinalizar: () => void
  onSalir: () => void
  onHeightChange?: (height: number) => void
  tipoActividad?: TipoActividadApi
}

export function LiveBottomPanel({
  elapsedLabel,
  distanceLabel,
  entrenamiento,
  enCurso,
  esLider,
  accion,
  paradaDesde,
  esIncidenteDetectado,
  puedeSolicitar,
  solicitudPendiente,
  paradaEnCurso,
  onDetenerse,
  onRetomar,
  onEstoyBien,
  onSolicitar,
  onFinalizar,
  onSalir,
  onHeightChange,
  tipoActividad = 'otro',
}: Props) {
  const { altoContraste, escalaBotones } = uiConfigPorActividad(tipoActividad)
  const theme = useTheme(altoContraste)
  const endBarMinHeight = Math.round(48 * escalaBotones)
  const insets = useSafeAreaInsets()
  const [metricsHeight, setMetricsHeight] = useState(88)
  const [actionsHeight, setActionsHeight] = useState(120)
  const [sheetIndex, setSheetIndex] = useState(0)

  const collapsedSnap = metricsHeight + HANDLE_HEIGHT
  const expandedSnap = collapsedSnap + Math.max(actionsHeight, 72)

  const snapPoints = useMemo(
    () => [collapsedSnap, expandedSnap],
    [collapsedSnap, expandedSnap]
  )

  const reportHeight = useCallback(
    (index: number) => {
      const snap = index === 0 ? collapsedSnap : expandedSnap
      onHeightChange?.(snap + insets.bottom)
    },
    [collapsedSnap, expandedSnap, insets.bottom, onHeightChange]
  )

  useEffect(() => {
    reportHeight(sheetIndex)
  }, [reportHeight, sheetIndex, collapsedSnap, expandedSnap])

  const onMetricsLayout = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height)
    if (h > 0 && h !== metricsHeight) setMetricsHeight(h)
  }

  const onActionsLayout = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height)
    if (h > 0 && h !== actionsHeight) setActionsHeight(h)
  }

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      bottomInset={insets.bottom}
      onChange={(index) => {
        setSheetIndex(index)
        reportHeight(index)
      }}
      backgroundStyle={{ backgroundColor: theme.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.textMute, width: 40 }}
      enablePanDownToClose={false}
      enableContentPanningGesture
      enableOverDrag={false}
    >
      <BottomSheetView>
        <TripMetricsPanel
          elapsedLabel={elapsedLabel}
          distanceLabel={distanceLabel}
          entrenamiento={entrenamiento}
          onLayout={onMetricsLayout}
        />

        <View onLayout={onActionsLayout}>
          {enCurso ? (
            <ParadaActionsBar
              paradaDesde={paradaDesde}
              esIncidenteDetectado={esIncidenteDetectado}
              puedeSolicitar={puedeSolicitar}
              solicitudPendiente={solicitudPendiente}
              ocupado={paradaEnCurso || accion}
              onDetenerse={onDetenerse}
              onRetomar={onRetomar}
              onEstoyBien={onEstoyBien}
              onSolicitar={onSolicitar}
              tipoActividad={tipoActividad}
            />
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.endBar,
              {
                minHeight: endBarMinHeight,
                borderTopColor: esLider ? theme.dangerWeak : theme.border,
                backgroundColor: esLider ? theme.dangerWeak : theme.surface2,
              },
              pressed && styles.endBarPressed,
              accion && styles.endBarDisabled,
            ]}
            onPress={esLider ? onFinalizar : onSalir}
            disabled={accion}
            accessibilityRole="button"
            accessibilityLabel={esLider ? 'Finalizar viaje' : 'Salir del viaje'}
          >
            <Text
              style={[
                styles.endBarText,
                { color: esLider ? theme.danger : theme.textDim, fontSize: tamanoOutdoor(15 * escalaBotones) },
              ]}
            >
              {accion ? 'Procesando...' : esLider ? 'Finalizar viaje' : 'Salir del viaje'}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  endBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  endBarPressed: {
    opacity: 0.7,
  },
  endBarDisabled: {
    opacity: 0.45,
  },
  endBarText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
