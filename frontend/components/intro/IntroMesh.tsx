import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { useTheme } from '@/components/MeshUI'
import {
  LETRAS,
  LETRAS_ALTO,
  LETRAS_Y,
  LOGO_COLOR,
  M_CAJA,
  M_CUERPO,
  RUEDA_ANILLO,
  RUEDA_CENTRO,
  RUEDA_RADIO,
  RUEDAS,
  RUTA,
  RUTA_LARGO,
  RUTA_PASO,
} from '@/components/intro/logoMesh'
import Colors from '@/constants/Colors'
import { useAuth } from '@/context/AuthContext'
import { esquemaDelSplash } from '@/lib/temaApp'

/** Línea de tiempo, en ms. */
const RECORRIDO_INICIO = 100
const RECORRIDO_FIN = 2000
const SALIDA_INICIO = 2080
const SALIDA_FIN = 2680
const ACHICA_INICIO = 2120
const LETRA_DURACION = 460
const FUNDIDO_INICIO = 3210
const FUNDIDO_DURACION = 250
/** El fondo pasa del color del splash nativo al del tema de la app. */
const CAMBIO_FONDO_FIN = 350
/** Margen para que la app termine de montarse abajo antes de animar: si no, la animación se traba. */
const ASENTAMIENTO_MS = 350
/** Tope de espera a la sesión antes de arrancar igual. */
const ESPERA_SESION_MAXIMA_MS = 1500

/** Escena en dp. La M arranca con el tamaño y el lugar del splash nativo (`imageWidth` de app.json). */
const ESCENA_ANCHO = 360
const ESCENA_ALTO = 200
const ESCENA_CENTRO_Y = ESCENA_ALTO / 2
const ESCALA_INICIAL = 0.25
const LOGOTIPO_ANCHO = 236
const LOGOTIPO_UNIDADES = 1727
const ESCALA_FINAL = LOGOTIPO_ANCHO / LOGOTIPO_UNIDADES
const LOGOTIPO_IZQUIERDA = (ESCENA_ANCHO - LOGOTIPO_ANCHO) / 2

const M_CENTRO_X = M_CAJA.x + M_CAJA.ancho / 2
const M_CENTRO_Y = M_CAJA.y + M_CAJA.alto / 2
const M_MITAD = M_CAJA.ancho / 2
const M_ANCHO_DP = M_CAJA.ancho * ESCALA_INICIAL
const M_ALTO_DP = M_CAJA.alto * ESCALA_INICIAL
const X_INICIAL = ESCENA_ANCHO / 2
const X_FINAL = LOGOTIPO_IZQUIERDA + M_MITAD * ESCALA_FINAL
const BORDE_FINAL = X_FINAL + M_MITAD * ESCALA_FINAL
/** Punto de la M que queda fijo cuando se inclina: a la altura de las ruedas. */
const PIVOTE_INCLINACION = (650 - M_CENTRO_Y) * ESCALA_INICIAL

/**
 * Integrantes de la animación: mismo aspecto que `live/MemberMarker`. Son decorativos,
 * con las iniciales del equipo: acá no entra ningún dato ni posición de usuarios de la app.
 */
const MARCADOR_AVATAR = 26
const MARCADOR_ANILLO = 2
const MARCADOR_CAJA = MARCADOR_AVATAR + MARCADOR_ANILLO * 2
const INTEGRANTES = [
  { iniciales: 'GF', color: '#4a9eff', separacion: 0, fase: 0, soyYo: false },
  { iniciales: 'JP', color: '#6bcb77', separacion: 124, fase: 2.1, soyYo: false },
  { iniciales: 'FG', color: '#ffd93d', separacion: 246, fase: 4.2, soyYo: true },
  { iniciales: 'MV', color: '#c77dff', separacion: 372, fase: 1.1, soyYo: false },
  { iniciales: 'BC', color: '#20c997', separacion: 500, fase: 3.3, soyYo: false },
  { iniciales: 'PG', color: '#748ffc', separacion: 624, fase: 5.2, soyYo: false },
] as const
const SEPARACION_MAXIMA = 624
/** El último del grupo se atrasa un poco y después alcanza al resto. */
const ATRASO_ULTIMO = 46

function avance(t: number, desde: number, hasta: number): number {
  'worklet'
  return Math.min(1, Math.max(0, (t - desde) / (hasta - desde)))
}

function suave(u: number): number {
  'worklet'
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/** Avanza hasta pasarse apenas y vuelve, para que la M frene con peso. */
function salida(u: number): number {
  'worklet'
  return u < 0.72 ? 1.035 * suave(u / 0.72) : 1.035 - 0.035 * suave((u - 0.72) / 0.28)
}

function inclinacion(u: number): number {
  'worklet'
  if (u <= 0) return 0
  if (u < 0.55) return -10 * Math.sin((Math.PI * u) / 0.55)
  return 4 * Math.sin((Math.PI * (u - 0.55)) / 0.45)
}

function centroM(t: number): number {
  'worklet'
  const u = avance(t, SALIDA_INICIO, SALIDA_FIN)
  return X_INICIAL + (X_FINAL - X_INICIAL) * salida(u)
}

function escalaM(t: number): number {
  'worklet'
  const u = suave(avance(t, ACHICA_INICIO, SALIDA_FIN))
  return ESCALA_INICIAL + (ESCALA_FINAL - ESCALA_INICIAL) * u
}

function bordeDerechoM(t: number): number {
  'worklet'
  return centroM(t) + M_MITAD * escalaM(t)
}

/** Distancia recorrida por el primero del grupo. */
function cabeza(t: number): number {
  'worklet'
  const u = avance(t, RECORRIDO_INICIO, RECORRIDO_FIN)
  return (0.5 - 0.5 * Math.cos(Math.PI * u)) * (RUTA_LARGO + SEPARACION_MAXIMA)
}

function puntoRuta(distancia: number): readonly [number, number] {
  'worklet'
  const ultimo = RUTA.length / 2 - 1
  const i = Math.min(ultimo - 0.001, Math.max(0, distancia / RUTA_PASO))
  const a = Math.floor(i)
  const f = i - a
  return [
    RUTA[a * 2]! + (RUTA[a * 2 + 2]! - RUTA[a * 2]!) * f,
    RUTA[a * 2 + 1]! + (RUTA[a * 2 + 3]! - RUTA[a * 2 + 1]!) * f,
  ]
}

function Marcador({
  t,
  iniciales,
  color,
  separacion,
  fase,
  soyYo,
  esUltimo,
}: (typeof INTEGRANTES)[number] & { t: SharedValue<number>; esUltimo: boolean }) {
  const estilo = useAnimatedStyle(() => {
    const atraso = esUltimo
      ? ATRASO_ULTIMO * Math.sin(Math.PI * avance(t.value, RECORRIDO_INICIO, RECORRIDO_FIN))
      : 0
    const pos = cabeza(t.value) - separacion - atraso
    if (pos <= 0 || pos >= RUTA_LARGO) return { opacity: 0 }

    const centro = puntoRuta(pos)
    const atras = puntoRuta(pos - 3)
    const adelante = puntoRuta(pos + 3)
    const nx = -(adelante[1] - atras[1])
    const ny = adelante[0] - atras[0]
    const largo = Math.hypot(nx, ny) || 1
    const extremo = Math.min(1, pos / 90, (RUTA_LARGO - pos) / 90)
    const vaiven = 12 * Math.sin(pos / 170 + fase) * extremo
    const x = (centro[0] + (nx / largo) * vaiven - M_CAJA.x) * ESCALA_INICIAL
    const y = (centro[1] + (ny / largo) * vaiven - M_CAJA.y) * ESCALA_INICIAL
    return {
      opacity: 1,
      transform: [
        { translateX: x - MARCADOR_CAJA / 2 },
        { translateY: y - MARCADOR_CAJA / 2 },
        { scale: Math.max(0.001, Math.min(1, pos / 110, (RUTA_LARGO - pos) / 110)) },
      ],
    }
  })

  return (
    <Animated.View
      style={[
        styles.marcador,
        { borderColor: soyYo ? '#15803d' : 'transparent' },
        estilo,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.iniciales} allowFontScaling={false}>
          {iniciales}
        </Text>
      </View>
    </Animated.View>
  )
}

const RUEDA_LADO = RUEDA_RADIO * 2
const RUEDA_FORMA =
  `M0 ${RUEDA_RADIO}a${RUEDA_RADIO} ${RUEDA_RADIO} 0 1 0 ${RUEDA_LADO} 0a${RUEDA_RADIO} ${RUEDA_RADIO} 0 1 0 ${-RUEDA_LADO} 0z` +
  `M${RUEDA_RADIO - RUEDA_ANILLO} ${RUEDA_RADIO}a${RUEDA_ANILLO} ${RUEDA_ANILLO} 0 1 0 ${RUEDA_ANILLO * 2} 0a${RUEDA_ANILLO} ${RUEDA_ANILLO} 0 1 0 ${-RUEDA_ANILLO * 2} 0z`

function Rueda({
  t,
  cx,
  cy,
  rebota,
}: {
  t: SharedValue<number>
  cx: number
  cy: number
  rebota: boolean
}) {
  const lado = RUEDA_LADO * ESCALA_INICIAL
  const estiloRueda = useAnimatedStyle(() => {
    if (!rebota) return {}
    const llegada = Math.min(1, Math.max(0, (cabeza(t.value) - RUTA_LARGO) / SEPARACION_MAXIMA))
    return { transform: [{ scale: 1 + 0.1 * Math.sin(Math.PI * llegada) }] }
  })
  // Un círculo perfecto no se ve girar: los rayos existen solo mientras la M se mueve.
  const estiloRayos = useAnimatedStyle(() => ({
    opacity:
      avance(t.value, SALIDA_INICIO, SALIDA_INICIO + 120) *
      (1 - avance(t.value, SALIDA_INICIO + 620, SALIDA_INICIO + 800)),
    transform: [
      { rotate: `${-1500 * suave(avance(t.value, SALIDA_INICIO, SALIDA_INICIO + 660))}deg` },
    ],
  }))

  return (
    <Animated.View
      style={[
        styles.capa,
        {
          left: (cx - RUEDA_RADIO - M_CAJA.x) * ESCALA_INICIAL,
          top: (cy - RUEDA_RADIO - M_CAJA.y) * ESCALA_INICIAL,
          width: lado,
          height: lado,
        },
        estiloRueda,
      ]}
    >
      <Svg width={lado} height={lado} viewBox={`0 0 ${RUEDA_LADO} ${RUEDA_LADO}`}>
        <Path d={RUEDA_FORMA} fill={LOGO_COLOR} fillRule="evenodd" />
        <Circle cx={RUEDA_RADIO} cy={RUEDA_RADIO} r={RUEDA_CENTRO} fill={LOGO_COLOR} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, estiloRayos]}>
        <Svg width={lado} height={lado} viewBox={`0 0 ${RUEDA_LADO} ${RUEDA_LADO}`}>
          {[0, 120, 240].map((giro) => (
            <Rect
              key={giro}
              x={RUEDA_RADIO - 5}
              y={RUEDA_RADIO - RUEDA_ANILLO - 2}
              width={10}
              height={RUEDA_ANILLO - RUEDA_CENTRO + 6}
              fill={LOGO_COLOR}
              transform={`rotate(${giro} ${RUEDA_RADIO} ${RUEDA_RADIO})`}
            />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

function Letra({ t, letra }: { t: SharedValue<number>; letra: (typeof LETRAS)[number] }) {
  const ancho = letra.ancho * ESCALA_FINAL
  const izquierda = LOGOTIPO_IZQUIERDA + (letra.x - M_CAJA.x) * ESCALA_FINAL
  // Arranca escondida detrás de la M y sale hacia su lugar.
  const recorrido = izquierda + ancho - BORDE_FINAL + 6
  const estilo = useAnimatedStyle(() => {
    const u = avance(t.value, letra.inicio, letra.inicio + LETRA_DURACION)
    return { transform: [{ translateX: -recorrido * Math.pow(1 - u, 3) }] }
  })
  const alto = LETRAS_ALTO * ESCALA_FINAL

  return (
    <Animated.View
      style={[
        styles.capa,
        {
          left: izquierda,
          top: ESCENA_CENTRO_Y + (LETRAS_Y - M_CENTRO_Y) * ESCALA_FINAL,
          width: ancho,
          height: alto,
        },
        estilo,
      ]}
    >
      <Svg width={ancho} height={alto} viewBox={`0 0 ${letra.ancho} ${LETRAS_ALTO}`}>
        <Path d={letra.d} fill={LOGO_COLOR} />
      </Svg>
    </Animated.View>
  )
}

type Props = {
  /** Ya hay algo dibujado: se puede sacar el splash nativo. */
  onLista: () => Promise<unknown>
  onFin: () => void
}

/**
 * Animación de apertura: un grupo recorre la M, la M se achica hacia la izquierda y
 * aparece MESH. Corre en el hilo de UI. Tapa la app hasta que la sesión está cargada.
 */
export function IntroMesh({ onLista, onFin }: Props) {
  const theme = useTheme()
  const { loading } = useAuth()
  const t = useSharedValue(0)
  const fondoSplash = Colors[esquemaDelSplash].background
  const [splashFuera, setSplashFuera] = useState(false)
  const [recorridoListo, setRecorridoListo] = useState(false)
  const pidioSplash = useRef(false)
  const arranco = useRef(false)
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pendientes = temporizadores.current
    return () => pendientes.forEach(clearTimeout)
  }, [])

  const sacarSplash = () => {
    if (pidioSplash.current) return
    pidioSplash.current = true
    const listo = () => setSplashFuera(true)
    onLista().then(listo, listo)
  }

  // El primer cuadro es igual al splash, así que esperar quieto no se nota. Recién se anima
  // cuando la sesión cargó y la app de abajo ya se montó: ese montaje ocupa el hilo de UI.
  useEffect(() => {
    if (!splashFuera) return
    const empezar = () => {
      if (arranco.current) return
      arranco.current = true
      t.value = withTiming(FUNDIDO_INICIO, { duration: FUNDIDO_INICIO, easing: Easing.linear })
      temporizadores.current.push(setTimeout(() => setRecorridoListo(true), FUNDIDO_INICIO))
    }
    const espera = setTimeout(empezar, loading ? ESPERA_SESION_MAXIMA_MS : ASENTAMIENTO_MS)
    return () => clearTimeout(espera)
    // `t` es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashFuera, loading])

  useEffect(() => {
    if (!recorridoListo || loading) return
    t.value = withTiming(FUNDIDO_INICIO + FUNDIDO_DURACION, {
      duration: FUNDIDO_DURACION,
      easing: Easing.linear,
    })
    temporizadores.current.push(setTimeout(onFin, FUNDIDO_DURACION + 30))
    // onFin no se incluye: el fundido se dispara una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorridoListo, loading])

  const estiloFondo = useAnimatedStyle(() => ({
    opacity: 1 - suave(avance(t.value, FUNDIDO_INICIO, FUNDIDO_INICIO + FUNDIDO_DURACION)),
  }))
  const estiloFondoSplash = useAnimatedStyle(() => ({
    opacity: 1 - suave(avance(t.value, 0, CAMBIO_FONDO_FIN)),
  }))
  const estiloM = useAnimatedStyle(() => ({
    transform: [
      { translateX: centroM(t.value) - X_INICIAL },
      { scale: escalaM(t.value) / ESCALA_INICIAL },
    ],
  }))
  const estiloCuerpo = useAnimatedStyle(() => ({
    transform: [
      { translateY: PIVOTE_INCLINACION },
      { skewX: `${inclinacion(avance(t.value, SALIDA_INICIO, SALIDA_FIN))}deg` },
      { translateY: -PIVOTE_INCLINACION },
    ],
  }))
  // Las letras solo se ven a la derecha de la M, que se va moviendo.
  const estiloRecorte = useAnimatedStyle(() => ({
    transform: [{ translateX: bordeDerechoM(t.value) }],
  }))
  const estiloContraRecorte = useAnimatedStyle(() => ({
    transform: [{ translateX: -bordeDerechoM(t.value) }],
  }))

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.fondo, { backgroundColor: theme.background }, estiloFondo]}
      onLayout={sacarSplash}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Mesh"
    >
      {fondoSplash !== theme.background && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: fondoSplash }, estiloFondoSplash]}
        />
      )}
      <View style={styles.escena}>
        <Animated.View style={[styles.recorte, estiloRecorte]}>
          <Animated.View style={[styles.escenaInterior, estiloContraRecorte]}>
            {LETRAS.map((letra) => (
              <Letra key={letra.x} t={t} letra={letra} />
            ))}
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.m, estiloM]}>
          <Animated.View style={[StyleSheet.absoluteFill, estiloCuerpo]}>
            <Svg
              width={M_ANCHO_DP}
              height={M_ALTO_DP}
              viewBox={`${M_CAJA.x} ${M_CAJA.y} ${M_CAJA.ancho} ${M_CAJA.alto}`}
            >
              <Path d={M_CUERPO} fill={LOGO_COLOR} />
            </Svg>
          </Animated.View>
          {RUEDAS.map(([cx, cy], i) => (
            <Rueda key={cx} t={t} cx={cx} cy={cy} rebota={i === 1} />
          ))}
          {INTEGRANTES.map((integrante, i) => (
            <Marcador
              key={integrante.iniciales}
              t={t}
              esUltimo={i === INTEGRANTES.length - 1}
              {...integrante}
            />
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fondo: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  escena: {
    width: ESCENA_ANCHO,
    height: ESCENA_ALTO,
  },
  escenaInterior: {
    width: ESCENA_ANCHO,
    height: ESCENA_ALTO,
  },
  recorte: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ESCENA_ANCHO,
    height: ESCENA_ALTO,
    overflow: 'hidden',
  },
  m: {
    position: 'absolute',
    left: X_INICIAL - M_ANCHO_DP / 2,
    top: ESCENA_CENTRO_Y - M_ALTO_DP / 2,
    width: M_ANCHO_DP,
    height: M_ALTO_DP,
  },
  capa: {
    position: 'absolute',
  },
  marcador: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MARCADOR_CAJA,
    height: MARCADOR_CAJA,
    borderRadius: MARCADOR_CAJA / 2,
    borderWidth: MARCADOR_ANILLO,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
  },
  avatar: {
    width: MARCADOR_AVATAR,
    height: MARCADOR_AVATAR,
    borderRadius: MARCADOR_AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Math.round(MARCADOR_AVATAR * 0.38),
  },
})
