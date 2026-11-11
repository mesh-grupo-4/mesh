import { memo, useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { nivelRacha } from '@/lib/rachasApi'

/** Fueguitos por nivel de racha (hitos de 3, 5 y 10 semanas). */
const CANTIDAD_POR_NIVEL = [0, 6, 10, 16]
const TAMANO_BASE = 18
const ANCHO_FUEGUITO = 44
const VAIVEN = 10
const RAFAGA_MS = 1800
const PROPORCION_AUREA = 0.618034

type FueguitoProps = {
  x: number
  tamano: number
  demora: number
  duracion: number
  recorrido: number
}

function Fueguito({ x, tamano, demora, duracion, recorrido }: FueguitoProps) {
  const progreso = useSharedValue(0)

  useEffect(() => {
    progreso.value = withDelay(
      demora,
      withTiming(1, { duration: duracion, easing: Easing.out(Easing.quad) })
    )
  }, [demora, duracion, progreso])

  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(progreso.value, [0, 0.12, 0.65, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateY: -recorrido * progreso.value },
      { translateX: Math.sin(progreso.value * Math.PI * 3) * VAIVEN },
      { scale: interpolate(progreso.value, [0, 0.2, 1], [0.5, 1.1, 0.6]) },
    ],
  }))

  return (
    <Animated.Text allowFontScaling={false} style={[styles.fueguito, { left: x, fontSize: tamano }, estilo]}>
      🔥
    </Animated.Text>
  )
}

type Props = {
  semanas: number
  alto: number
}

/**
 * Ráfaga de fueguitos al entrar al Perfil: una sola pasada, sin animación infinita. Cuanto
 * más larga la racha, más fueguitos. Remontar el componente (`key`) repite la ráfaga.
 */
export const FueguitosRacha = memo(function FueguitosRacha({ semanas, alto }: Props) {
  const { width } = useWindowDimensions()
  const movimientoReducido = useReducedMotion()
  const nivel = nivelRacha(semanas)
  const cantidad = CANTIDAD_POR_NIVEL[nivel] ?? 0

  if (cantidad === 0 || movimientoReducido) return null

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.capa, { height: alto }]}
    >
      {Array.from({ length: cantidad }, (_, i) => {
        // Reparto determinístico: se ve desordenado pero no se amontona.
        const azar = ((i + 1) * PROPORCION_AUREA) % 1
        return (
          <Fueguito
            key={i}
            x={azar * (width - ANCHO_FUEGUITO)}
            tamano={TAMANO_BASE + nivel * 4 + (i % 3) * 5}
            demora={(i / cantidad) * RAFAGA_MS}
            duracion={2200 + azar * 1200}
            recorrido={alto * (0.65 + azar * 0.3)}
          />
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  capa: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  fueguito: {
    position: 'absolute',
    bottom: 0,
  },
})
