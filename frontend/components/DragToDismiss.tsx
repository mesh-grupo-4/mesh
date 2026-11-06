import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

type Props = {
  /** Se llama al soltar el gesto pasado el umbral de cierre. */
  onDismiss: () => void
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Distancia mínima arrastrada para que al soltar se cierre (default 110). */
  umbral?: number
  /**
   * Si se pasa, solo esta parte responde al arrastre. Para hojas con scroll: si el gesto
   * cubre toda la hoja, deslizar el contenido hacia abajo la cerraría.
   */
  cabecera?: ReactNode
}

/**
 * Envuelve el contenido de una hoja inferior y permite cerrarla arrastrándola
 * hacia abajo. Debe usarse dentro de un `GestureHandlerRootView` (los `Modal`
 * de RN quedan fuera del root global, así que hay que ponerlo en cada sheet).
 */
export function DragToDismiss({ onDismiss, children, style, umbral = 110, cabecera }: Props) {
  const ty = useSharedValue(0)

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-12)
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (ty.value > umbral || e.velocityY > 800) {
        ty.value = withTiming(700, { duration: 200 })
        runOnJS(onDismiss)()
      } else {
        ty.value = withSpring(0, { damping: 18, stiffness: 220 })
      }
    })

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  if (cabecera) {
    return (
      <Animated.View style={[style, animStyle]}>
        <GestureDetector gesture={pan}>
          <Animated.View>{cabecera}</Animated.View>
        </GestureDetector>
        {children}
      </Animated.View>
    )
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  )
}
