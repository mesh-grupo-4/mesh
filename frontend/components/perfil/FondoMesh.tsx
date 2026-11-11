import { memo, useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
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
}: FondoProps) {
  const { width } = useWindowDimensions()

  const posiciones = useMemo(() => {
    const filas = Math.ceil(alto / PASO_Y) + 1
    const columnas = Math.ceil(width / PASO_X) + 2
    const lista: { x: number; y: number; umbral: number }[] = []
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
  }, [alto, width])

  const dibujar = (lista: typeof posiciones, id: string) =>
    lista.map(({ x, y }) => (
      <Use key={`${x}-${y}`} href={`#${id}`} transform={`translate(${x} ${y}) scale(${ESCALA})`} />
    ))

  const logotipo = (id: string, fill: string) => (
    <G id={id} fill={fill} transform={`translate(${-M_CAJA.x} ${-M_CAJA.y})`}>
      <Path d={M_CON_RUEDAS} fillRule="evenodd" />
      {LETRAS.map((letra) => (
        <Path key={letra.x} d={letra.d} transform={`translate(${letra.x} ${LETRAS_Y})`} />
      ))}
    </G>
  )

  return (
    <View pointerEvents="none" style={[styles.fondo, { height: alto }]}>
      <Svg width={width} height={alto}>
        <Defs>
          {logotipo(ID_LOGOTIPO, color)}
          {logotipo(ID_LOGOTIPO_RACHA, colorRacha)}
        </Defs>
        <G opacity={OPACIDAD}>
          {dibujar(
            posiciones.filter((p) => p.umbral >= intensidadRacha),
            ID_LOGOTIPO
          )}
        </G>
        <G opacity={OPACIDAD_RACHA_MIN + OPACIDAD_RACHA_RANGO * intensidadRacha}>
          {dibujar(
            posiciones.filter((p) => p.umbral < intensidadRacha),
            ID_LOGOTIPO_RACHA
          )}
        </G>
      </Svg>
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
  },
})
