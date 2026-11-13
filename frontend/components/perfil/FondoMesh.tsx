import { memo, useEffect, useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Use } from 'react-native-svg'

import {
  LETRAS,
  LETRAS_Y,
  M_CAJA,
  M_CUERPO,
  RUEDA_ANILLO,
  RUEDA_CENTRO,
  RUEDA_RADIO,
  RUEDAS,
} from '@/components/intro/logoMesh'

const ANCHO_LOGOTIPO_UNIDADES = LETRAS[2].x + LETRAS[2].ancho - M_CAJA.x
const ANCHO_LOGOTIPO = 54
const ESCALA = ANCHO_LOGOTIPO / ANCHO_LOGOTIPO_UNIDADES
const PASO_X = 84
const PASO_Y = 32
const OPACIDAD = 0.1
const OPACIDAD_RACHA_MIN = 0.22
const OPACIDAD_RACHA_RANGO = 0.33
const PROPORCION_AUREA = 0.618034
const ID_LOGOTIPO = 'mesh-logotipo'
const ID_LOGOTIPO_RACHA = 'mesh-logotipo-racha'
const ID_FUNDIDO = 'mesh-fundido'

function circulo(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`
}

const M_CON_RUEDAS = [
  M_CUERPO,
  ...RUEDAS.flatMap(([cx, cy]) => [
    circulo(cx, cy, RUEDA_RADIO),
    circulo(cx, cy, RUEDA_ANILLO),
    circulo(cx, cy, RUEDA_CENTRO),
  ]),
].join(' ')

type FondoProps = {
  color: string
  alto: number
  colorRacha: string
  /** De 0 a 1: parte de los logotipos que se encienden con la racha. */
  intensidadRacha: number
  /**
   * Perfiles: el patrón se mece lento en diagonal y los logotipos de la racha "respiran"
   * a destiempo. Se apaga si el sistema pide reducir el movimiento.
   */
  animado?: boolean
}

type Posicion = { x: number; y: number; umbral: number }

/**
 * Ida y vuelta de un paso del patrón. Es un vaivén y no un loop que vuelve a empezar:
 * al reiniciar, cada lugar quedaba con otro logotipo y la racha encendida saltaba.
 */
const DURACION_VAIVEN_MS = 14_000
/** Ciclo de brillo de los logotipos de la racha; tres grupos desfasados entre sí. */
const DURACION_DESTELLO_MS = 3_200
const GRUPOS_DESTELLO = 3
/** Cuánto baja el brillo de un logotipo encendido en el punto más bajo del ciclo. */
const BAJA_DESTELLO = 0.55

/** Opacidad del grupo `k` en el instante `v` (0 a 1) del ciclo de destello. */
function brilloDestello(v: number, k: number): number {
  'worklet'
  const fase = v + k / GRUPOS_DESTELLO
  return 1 - BAJA_DESTELLO * (0.5 - 0.5 * Math.cos(2 * Math.PI * fase))
}

const logotipo = (id: string, fill: string) => (
  <G id={id} fill={fill} transform={`translate(${-M_CAJA.x} ${-M_CAJA.y})`}>
    <Path d={M_CON_RUEDAS} fillRule="evenodd" />
    {LETRAS.map((letra) => (
      <Path key={letra.x} d={letra.d} transform={`translate(${letra.x} ${LETRAS_Y})`} />
    ))}
  </G>
)

/** Una capa de logotipos en su propio Svg, para poder animar su opacidad por separado. */
function CapaLogos({
  posiciones,
  id,
  color,
  opacidad,
  ancho,
  alto,
}: {
  posiciones: Posicion[]
  id: string
  color: string
  opacidad: number
  ancho: number
  alto: number
}) {
  if (posiciones.length === 0) return null
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
      <Defs>{logotipo(id, color)}</Defs>
      <G opacity={opacidad}>
        {posiciones.map(({ x, y }) => (
          <Use key={`${x}-${y}`} href={`#${id}`} transform={`translate(${x} ${y}) scale(${ESCALA})`} />
        ))}
      </G>
    </Svg>
  )
}

/**
 * Fondo de la cabecera del Perfil: el logotipo de Mesh repetido en filas intercaladas.
 * Con racha, una parte de los logotipos se enciende; cuanto más larga, más y más intensos.
 */
export const FondoMesh = memo(function FondoMesh({
  color,
  alto,
  colorRacha,
  intensidadRacha,
  animado = false,
}: FondoProps) {
  const { width } = useWindowDimensions()
  const movimientoReducido = useReducedMotion()
  const mover = animado && !movimientoReducido
  // Con vaivén se dibuja un paso de más hacia la derecha y hacia abajo, para no dejar huecos.
  const ancho = width + PASO_X
  const altoDibujo = alto + PASO_Y

  const posiciones = useMemo(() => {
    const filas = Math.ceil(altoDibujo / PASO_Y) + 1
    const columnas = Math.ceil(ancho / PASO_X) + 2
    const lista: Posicion[] = []
    for (let fila = 0; fila < filas; fila++) {
      const desfase = fila % 2 === 0 ? 0 : PASO_X / 2
      for (let columna = -1; columna < columnas; columna++) {
        lista.push({
          x: columna * PASO_X + desfase,
          y: fila * PASO_Y + 6,
          // Determinístico: al crecer la racha se suman logotipos, no cambian de lugar.
          umbral: ((fila * 7 + (columna + 1) * 13) * PROPORCION_AUREA) % 1,
        })
      }
    }
    return lista
  }, [altoDibujo, ancho])

  const base = useMemo(
    () => posiciones.filter((p) => p.umbral >= intensidadRacha),
    [posiciones, intensidadRacha]
  )
  // Los encendidos se reparten en grupos que respiran desfasados.
  const encendidos = useMemo(() => {
    const grupos: Posicion[][] = Array.from({ length: GRUPOS_DESTELLO }, () => [])
    posiciones
      .filter((p) => p.umbral < intensidadRacha)
      .forEach((p, i) => grupos[i % GRUPOS_DESTELLO]!.push(p))
    return grupos
  }, [posiciones, intensidadRacha])

  const vaiven = useSharedValue(0)
  const destello = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(vaiven)
    cancelAnimation(destello)
    vaiven.value = 0
    destello.value = 0
    if (!mover) return
    vaiven.value = withRepeat(
      withTiming(1, { duration: DURACION_VAIVEN_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
    destello.value = withRepeat(
      withTiming(1, { duration: DURACION_DESTELLO_MS, easing: Easing.linear }),
      -1,
      false
    )
    return () => {
      cancelAnimation(vaiven)
      cancelAnimation(destello)
    }
  }, [mover, vaiven, destello])

  const estiloVaiven = useAnimatedStyle(() => ({
    transform: [{ translateX: -vaiven.value * PASO_X }, { translateY: -vaiven.value * PASO_Y }],
  }))
  // Tres hooks fijos (uno por grupo): la cantidad de grupos no cambia.
  const estiloGrupo0 = useAnimatedStyle(() => ({ opacity: mover ? brilloDestello(destello.value, 0) : 1 }))
  const estiloGrupo1 = useAnimatedStyle(() => ({ opacity: mover ? brilloDestello(destello.value, 1) : 1 }))
  const estiloGrupo2 = useAnimatedStyle(() => ({ opacity: mover ? brilloDestello(destello.value, 2) : 1 }))
  const estilosGrupo = [estiloGrupo0, estiloGrupo1, estiloGrupo2]

  const opacidadRacha = OPACIDAD_RACHA_MIN + OPACIDAD_RACHA_RANGO * intensidadRacha

  return (
    <View pointerEvents="none" style={[styles.fondo, { height: alto }]}>
      <Animated.View style={[{ width: ancho, height: altoDibujo }, estiloVaiven]}>
        <CapaLogos
          posiciones={base}
          id={ID_LOGOTIPO}
          color={color}
          opacidad={OPACIDAD}
          ancho={ancho}
          alto={altoDibujo}
        />
        {encendidos.map((grupo, k) => (
          <Animated.View key={k} style={[StyleSheet.absoluteFill, estilosGrupo[k]]}>
            <CapaLogos
              posiciones={grupo}
              id={`${ID_LOGOTIPO_RACHA}-${k}`}
              color={colorRacha}
              opacidad={opacidadRacha}
              ancho={ancho}
              alto={altoDibujo}
            />
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  )
})

/** Disuelve el fondo hacia el color de la pantalla, para que el nombre quede sobre liso. */
export const FundidoMesh = memo(function FundidoMesh({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={ID_FUNDIDO} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.6" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${ID_FUNDIDO})`} />
      </Svg>
    </View>
  )
})

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // El dibujo es un paso más grande que el fondo para el vaivén: se recorta.
    overflow: 'hidden',
  },
})
