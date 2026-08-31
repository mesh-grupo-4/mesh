import { useMemo } from 'react'
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/components/MeshUI'

/** Radio del arco: un poco más grande que el círculo (28px) para abrazarlo. */
const NOTCH_RADIUS = 32

/** Alto/padding de diseño de la tab bar, SIN contar el inset del sistema
 * (barra de navegación de Android, home indicator de iOS) — ese se suma
 * aparte con `insets.bottom`, que ya viene en las props (no hace falta
 * `useSafeAreaInsets()`). Antes estos valores eran fijos en `_layout.tsx` y
 * no sumaban el inset real: en equipos con barra de navegación de Android
 * más alta (3 botones, skins de fabricante), el contenido de la tab bar
 * quedaba tapado por esos botones.
 */
const BASE_HEIGHT = Platform.OS === 'ios' ? 88 : 64
const BASE_PADDING_BOTTOM = Platform.OS === 'ios' ? 24 : 8

export function MeshTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions()
  const theme = useTheme()
  const cx = width / 2
  const borderColor = theme.border
  const insetBottom = props.insets.bottom

  const path = `
    M 0 0
    L ${cx - NOTCH_RADIUS} 0
    A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${cx + NOTCH_RADIUS} 0
    L ${width} 0
  `

  const notchFill = `
    M ${cx - NOTCH_RADIUS} 0
    A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${cx + NOTCH_RADIUS} 0
    Z
  `

  // El estilo estático de `screenOptions.tabBarStyle` (en `_layout.tsx`) es
  // el mismo para todas las rutas: acá lo completamos con el inset real del
  // dispositivo antes de pasárselo a `BottomTabBar`, que internamente lee
  // `tabBarStyle` desde `descriptors[rutaActiva].options`.
  const descriptors = useMemo(() => {
    const next: BottomTabBarProps['descriptors'] = {}
    for (const key of Object.keys(props.descriptors)) {
      const d = props.descriptors[key]!
      next[key] = {
        ...d,
        options: {
          ...d.options,
          tabBarStyle: [
            d.options.tabBarStyle,
            {
              height: BASE_HEIGHT + insetBottom,
              paddingBottom: BASE_PADDING_BOTTOM + insetBottom,
            },
          ],
        },
      }
    }
    return next
  }, [props.descriptors, insetBottom])

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.background }]}>
      <View style={styles.borderLayer} pointerEvents="none">
        <Svg
          width={width}
          height={NOTCH_RADIUS + 1}
          style={styles.borderSvg}
          viewBox={`0 ${-NOTCH_RADIUS} ${width} ${NOTCH_RADIUS + 1}`}
        >
          <Path d={notchFill} fill={theme.background} />
          <Path d={path} stroke={borderColor} strokeWidth={1} fill="none" />
        </Svg>
      </View>
      <BottomTabBar {...props} descriptors={descriptors} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  borderLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 0,
  },
  borderSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
})
