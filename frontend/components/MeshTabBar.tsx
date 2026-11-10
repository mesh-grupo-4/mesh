import { useEffect, useMemo } from 'react'
import { BlurView } from 'expo-blur'
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useBlurTargetTab } from '@/components/BlurTargetTab'
import { DeslizarEntreTabs } from '@/components/DeslizarEntreTabs'
import Colors from '@/constants/Colors'
import { TAB_BAR_ALTO, TAB_BAR_MARGEN, useTabBarBottom } from '@/hooks/useEspacioTabBar'

const RADIO_CAPSULA = TAB_BAR_ALTO / 2
const SEPARACION_ACTIVO = 3

function FondoCapsula({
  ruta,
  indice,
  total,
  ancho,
}: {
  ruta: string
  indice: number
  total: number
  ancho: number
}) {
  const objetivoBlur = useBlurTargetTab(ruta)
  const anchoItem = ancho / total
  const x = useSharedValue(indice * anchoItem)

  useEffect(() => {
    x.value = withTiming(indice * anchoItem, { duration: 240, easing: Easing.out(Easing.cubic) })
  }, [indice, anchoItem, x])

  const estiloActivo = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View style={styles.capsula}>
      <BlurView
        // Cada pestaña tiene su propio objetivo: remontar evita arrastrar el anterior.
        key={ruta}
        tint="dark"
        intensity={40}
        blurMethod={objetivoBlur ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurTarget={objetivoBlur}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.velo]} />
      <Animated.View
        style={[styles.activo, { width: anchoItem - (SEPARACION_ACTIVO + 1) * 2 }, estiloActivo]}
      />
    </View>
  )
}

/**
 * Tab bar flotante. Sigue usando `BottomTabBar` para no alterar la navegación,
 * el contador de pendientes ni la accesibilidad: acá solo cambia lo visual.
 * Es oscura en ambos temas para que los ítems blancos siempre se lean.
 */
export function MeshTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions()
  const bottom = useTabBarBottom()
  const ancho = width - TAB_BAR_MARGEN * 2
  const { index } = props.state
  const total = props.state.routes.length

  const descriptors = useMemo(() => {
    const ruta = props.state.routes[index]!.name
    const fondo = <FondoCapsula ruta={ruta} indice={index} total={total} ancho={ancho} />
    const next: BottomTabBarProps['descriptors'] = {}
    for (const key of Object.keys(props.descriptors)) {
      const d = props.descriptors[key]!
      next[key] = {
        ...d,
        options: {
          ...d.options,
          tabBarBackground: () => fondo,
          tabBarIconStyle: styles.icono,
          tabBarLabelStyle: styles.label,
          tabBarStyle: [styles.barra, { bottom }],
        },
      }
    }
    return next
  }, [props.descriptors, props.state.routes, index, total, ancho, bottom])

  return (
    <DeslizarEntreTabs navigation={props.navigation}>
      <BottomTabBar {...props} descriptors={descriptors} />
    </DeslizarEntreTabs>
  )
}

const styles = StyleSheet.create({
  barra: {
    position: 'absolute',
    // `start`/`end`, no `left`/`right`: BottomTabBar fija los primeros y en nativo tienen prioridad.
    start: TAB_BAR_MARGEN,
    end: TAB_BAR_MARGEN,
    height: TAB_BAR_ALTO,
    paddingTop: 6,
    paddingBottom: 0,
    borderTopWidth: 0,
    borderRadius: RADIO_CAPSULA,
    backgroundColor: 'transparent',
    overflow: 'visible',
    // La sombra va por boxShadow: la elevation que trae BottomTabBar se vería a través del vidrio.
    elevation: 0,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.32)',
  },
  capsula: {
    flex: 1,
    borderRadius: RADIO_CAPSULA,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    // Borde superior más claro: da el brillo del vidrio.
    borderTopColor: 'rgba(255, 255, 255, 0.36)',
    overflow: 'hidden',
  },
  // 58 %: lo más transparente que deja legible el texto blanco sobre un fondo claro.
  velo: { backgroundColor: `${Colors.dark.background}94` },
  activo: {
    position: 'absolute',
    top: SEPARACION_ACTIVO,
    bottom: SEPARACION_ACTIVO,
    left: SEPARACION_ACTIVO,
    borderRadius: RADIO_CAPSULA - SEPARACION_ACTIVO - 1,
    // 82 %: translúcida, con contraste suficiente para el acento de la marca.
    backgroundColor: `${Colors.dark.background}D1`,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  icono: { width: 26, height: 22 },
  label: { fontSize: 11, fontWeight: '600' },
})
