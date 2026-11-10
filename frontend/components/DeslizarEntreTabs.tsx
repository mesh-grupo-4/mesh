import { useMemo, type ReactElement } from 'react'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

/** Arrastre mínimo para que el gesto se tome como horizontal y no como scroll. */
const ACTIVACION_X = 24
const CANCELACION_Y = 16
const DISTANCIA_MINIMA = 60
const VELOCIDAD_MINIMA = 500

type NavegacionTabs = {
  getState: () => { index: number; routes: { name: string }[] }
  navigate: (nombre: string) => void
}

type Props = {
  navigation: NavegacionTabs
  children: ReactElement
}

/**
 * Cambia a la pestaña contigua al deslizar: hacia la izquierda avanza y hacia la
 * derecha retrocede. Las listas horizontales de adentro (chips) conservan su scroll.
 */
export function DeslizarEntreTabs({ navigation, children }: Props) {
  const gesto = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-ACTIVACION_X, ACTIVACION_X])
        .failOffsetY([-CANCELACION_Y, CANCELACION_Y])
        .onEnd((e, completado) => {
          if (!completado) return
          const lejos = Math.abs(e.translationX) >= DISTANCIA_MINIMA
          const rapido = e.translationX * e.velocityX > 0 && Math.abs(e.velocityX) >= VELOCIDAD_MINIMA
          if (!lejos && !rapido) return

          const { index, routes } = navigation.getState()
          const destino = routes[index + (e.translationX < 0 ? 1 : -1)]
          if (destino) navigation.navigate(destino.name)
        }),
    [navigation]
  )

  return <GestureDetector gesture={gesto}>{children}</GestureDetector>
}
