import { Feather } from '@expo/vector-icons'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import type { PasoDefinicion } from '@/components/ayuda/contenidoAyuda'
import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { useEspacioTabBar } from '@/hooks/useEspacioTabBar'

const ALTO = 52
/** Ancho del ícono con su "+": contraído, el botón queda cuadrado (ALTO × ALTO). */
const ANCHO_ICONO = 28
const PADDING_CONTRAIDO = (ALTO - ANCHO_ICONO) / 2
const PADDING_DERECHO_EXTENDIDO = 20
const SEPARACION_TEXTO = 8
/** Cuánto se ve extendido al entrar a la pestaña antes de contraerse solo. */
const MS_EXTENDIDO = 2500
const MS_ANIMACION = 220
/** Desplazamiento hacia abajo que cuenta como "empezó a scrollear". */
const UMBRAL_SCROLL = 4

/**
 * Lo que una lista tiene que sumar a su `paddingBottom` (además del espacio de
 * la barra de pestañas) para que el botón flotante no tape la última tarjeta.
 */
export const ESPACIO_BOTON_FLOTANTE = ALTO + 12

/**
 * Estado del botón flotante de una pestaña: aparece extendido (ícono + texto)
 * cada vez que se entra, y se contrae al ícono a los pocos segundos o apenas
 * se scrollea hacia abajo, lo que pase primero.
 *
 * `onScroll` va en la lista de la pantalla. `clave` vuelve a extenderlo cuando
 * cambia (ej. al pasar de Grupos a Amigos dentro de la misma pestaña).
 */
export function useBotonFlotante(clave?: string) {
  const [extendido, setExtendido] = useState(true)
  const ultimoY = useRef(0)

  useFocusEffect(
    useCallback(() => {
      setExtendido(true)
      const timer = setTimeout(() => setExtendido(false), MS_EXTENDIDO)
      return () => clearTimeout(timer)
    }, [clave])
  )

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    // El pull-to-refresh da offsets negativos: no cuenta como scroll hacia abajo.
    if (y > 0 && y - ultimoY.current > UMBRAL_SCROLL) setExtendido(false)
    ultimoY.current = y
  }, [])

  return { extendido, onScroll }
}

type Props = {
  /** Ícono de la pestaña (el mismo de la barra); se le suma un "+" en la esquina. */
  icono: React.ComponentProps<typeof FontAwesome>['name']
  label: string
  onPress: () => void
  /** Viene de `useBotonFlotante()`. En false queda solo el ícono. */
  extendido: boolean
  /** En false no se muestra (ej. mientras se seleccionan elementos para borrar). */
  visible?: boolean
  /** Paso del tour de ayuda que resalta este botón. */
  ayuda?: PasoDefinicion
}

/**
 * Acción principal de una pestaña ("Nuevo viaje", "Crear grupo"…): flota abajo
 * a la derecha, sobre la barra de pestañas, al alcance del pulgar. Mismo lugar
 * y mismo aspecto en todas las secciones. Se contrae al ícono de la sección
 * con un "+" para no tapar la lista (ver `useBotonFlotante`).
 */
export function BotonFlotante({ icono, label, onPress, extendido, visible = true, ayuda }: Props) {
  const theme = useTheme()
  const espacioTabBar = useEspacioTabBar()

  // Ancho natural del texto, medido con una copia invisible: la etiqueta
  // visible se anima entre ese ancho y 0.
  const anchoTexto = useSharedValue(0)
  const progreso = useSharedValue(extendido ? 1 : 0)

  useEffect(() => {
    progreso.value = withTiming(extendido ? 1 : 0, { duration: MS_ANIMACION })
  }, [extendido, progreso])

  const estiloFila = useAnimatedStyle(() => ({
    paddingRight:
      PADDING_CONTRAIDO + (PADDING_DERECHO_EXTENDIDO - PADDING_CONTRAIDO) * progreso.value,
  }))

  const estiloEtiqueta = useAnimatedStyle(() => {
    // Hasta medir el texto se deja en su ancho natural (sin parpadeo al montar).
    if (anchoTexto.value === 0) return progreso.value > 0.5 ? {} : { width: 0, opacity: 0 }
    return {
      width: (anchoTexto.value + SEPARACION_TEXTO) * progreso.value,
      opacity: progreso.value * progreso.value,
    }
  })

  if (!visible) return null

  const estiloTexto = [styles.texto, { color: theme.onAccent }]

  const boton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        styles.sombra,
        { backgroundColor: theme.accent },
        pressed && styles.presionado,
      ]}
    >
      <Animated.View style={[styles.fila, estiloFila]}>
        <View style={styles.icono}>
          <FontAwesome name={icono} size={22} color={theme.onAccent} />
          {/* El aro del color del botón separa el "+" del ícono que tiene atrás. */}
          <View style={[styles.mas, { backgroundColor: theme.onAccent, borderColor: theme.accent }]}>
            <Feather name="plus" size={10} color={theme.accent} />
          </View>
        </View>
        <Animated.View style={[styles.etiqueta, estiloEtiqueta]}>
          {/* 19 px en negrita: texto grande, legible en blanco sobre el acento de la marca.
              Al contraerse se recorta por la derecha (sin "…"). */}
          <Text style={[estiloTexto, styles.separacion]} numberOfLines={1} ellipsizeMode="clip">
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )

  return (
    <View style={[styles.contenedor, { bottom: espacioTabBar }]} pointerEvents="box-none">
      {ayuda ? <PasoAyuda {...ayuda}>{boton}</PasoAyuda> : boton}
      {/* Copia invisible para medir el texto. Vive en una caja ancha propia: dentro
          del botón contraído se mediría recortada. */}
      <View
        style={styles.medicion}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          style={estiloTexto}
          numberOfLines={1}
          onLayout={(e) => {
            const ancho = Math.ceil(e.nativeEvent.layout.width)
            if (ancho > 0) anchoTexto.value = ancho
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  )
}

/** Estilos compartidos con el "Viaje YA" de Inicio, que vive dentro de su propio dock. */
export const estilosBotonFlotante = StyleSheet.create({
  boton: {
    height: ALTO,
    paddingHorizontal: 20,
    borderRadius: ALTO / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  texto: { fontSize: 19, fontWeight: '800' },
  sombra: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  presionado: { opacity: 0.88 },
})

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', right: 16 },
  boton: {
    height: ALTO,
    minWidth: ALTO,
    // Cuadrado redondeado, como el FAB de Material 3.
    borderRadius: 16,
    overflow: 'hidden',
  },
  fila: {
    height: ALTO,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PADDING_CONTRAIDO,
  },
  icono: {
    width: ANCHO_ICONO,
    height: ANCHO_ICONO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mas: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiqueta: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // Margen (no padding de la etiqueta): con ancho 0 queda recortado y el botón, cuadrado.
  separacion: { marginLeft: SEPARACION_TEXTO },
  // flexShrink 0: el texto conserva su ancho natural y la etiqueta lo recorta.
  texto: { ...estilosBotonFlotante.texto, flexShrink: 0 },
  sombra: estilosBotonFlotante.sombra,
  presionado: estilosBotonFlotante.presionado,
  /** Invisible y sin ocupar lugar: solo sirve para medir el texto. */
  medicion: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 1000,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    opacity: 0,
  },
})
