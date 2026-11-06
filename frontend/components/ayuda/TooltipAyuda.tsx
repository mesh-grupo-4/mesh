import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View, StyleSheet, type LayoutRectangle, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable } from '@/components/Pressable'
import { useCopilot, type TooltipProps } from 'react-native-copilot'
import { useTheme } from '@/components/MeshUI'
import { tamanoOutdoor } from '@/constants/Typography'

const MARGEN = 12
const GUTTER = 16
const ANCHO_MAX = 360

/**
 * Estilo que se pasa como `tooltipStyle` al `CopilotProvider`.
 *
 * react-native-copilot envuelve el tooltip en un contenedor propio con fondo
 * blanco, padding y `overflow: hidden`, y lo ubica arriba o abajo del elemento
 * sin limitarlo a la pantalla: en modo oscuro se veía un recuadro blanco
 * recortado, y con elementos grandes (el mapa del viaje) el tooltip quedaba
 * fuera de la pantalla, con el overlay bloqueando todos los toques.
 *
 * Acá neutralizamos ese contenedor: lo estiramos a pantalla completa y
 * transparente, y `TooltipAyuda` posiciona la tarjeta por su cuenta.
 */
export const estiloContenedorTooltip: ViewStyle = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  maxWidth: '100%',
  paddingTop: 0,
  paddingHorizontal: 0,
  backgroundColor: 'transparent',
  borderRadius: 0,
  overflow: 'visible',
}

/** Número de paso por defecto de copilot (círculo verde): no lo mostramos. */
export function SinNumeroDePaso() {
  return null
}

/**
 * Tooltip de los tours de ayuda, tematizado con `useTheme()`.
 *
 * Funciona como un popup: ocupa toda la pantalla (tocar en cualquier lado
 * avanza al siguiente paso) y la tarjeta se ubica debajo o arriba del elemento
 * resaltado según el espacio libre, siempre acotada al área visible.
 */
export function TooltipAyuda({ labels }: TooltipProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { goToNext, goToPrev, stop, currentStep, isFirstStep, isLastStep, copilotEvents } = useCopilot()

  const [pantalla, setPantalla] = useState<{ width: number; height: number } | null>(null)
  const [altoTarjeta, setAltoTarjeta] = useState<number | null>(null)
  const [objetivo, setObjetivo] = useState<LayoutRectangle | null>(null)

  // Mide el elemento resaltado. Se repite en cada `stepChange`, incluso para el
  // mismo paso: `ScrollViewAyuda` lo vuelve a emitir después de scrollear.
  const medicion = useRef(0)
  const medirObjetivo = useCallback((paso: { measure: () => Promise<LayoutRectangle> } | undefined) => {
    const id = ++medicion.current
    // Esperamos un frame: copilot puede estar animando hacia el paso.
    requestAnimationFrame(() => {
      paso
        ?.measure()
        .then((rect) => {
          if (id === medicion.current) setObjetivo(rect)
        })
        .catch(() => {})
    })
  }, [])

  const pasoInicial = useRef(currentStep)
  useEffect(() => {
    medirObjetivo(pasoInicial.current)
    copilotEvents.on('stepChange', medirObjetivo)
    return () => {
      copilotEvents.off('stepChange', medirObjetivo)
      medicion.current++
    }
  }, [copilotEvents, medirObjetivo])

  const avanzar = () => void (isLastStep ? stop() : goToNext())

  let top: number | null = null
  if (pantalla && altoTarjeta != null) {
    const minTop = insets.top + MARGEN
    const maxTop = Math.max(minTop, pantalla.height - insets.bottom - MARGEN - altoTarjeta)
    let deseado = (pantalla.height - altoTarjeta) / 2

    if (objetivo) {
      const arriba = objetivo.y
      const abajo = objetivo.y + objetivo.height
      const visible = abajo > 0 && arriba < pantalla.height
      if (visible) {
        const espacioAbajo = pantalla.height - insets.bottom - abajo - MARGEN
        const espacioArriba = arriba - insets.top - MARGEN
        if (espacioAbajo >= altoTarjeta) deseado = abajo + MARGEN
        else if (espacioArriba >= altoTarjeta) deseado = arriba - MARGEN - altoTarjeta
        // Sin lugar a ningún lado (ej. un mapa a pantalla completa): se superpone
        // sobre el elemento, del lado con más espacio.
        else deseado = espacioAbajo >= espacioArriba ? maxTop : minTop
      }
    }
    top = Math.min(Math.max(deseado, minTop), maxTop)
  }

  const ancho = pantalla ? Math.min(pantalla.width - GUTTER * 2, ANCHO_MAX) : ANCHO_MAX

  return (
    <Pressable
      feedback={false}
      onPress={avanzar}
      accessibilityRole="button"
      accessibilityLabel={isLastStep ? labels.finish : labels.next}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setPantalla({ width, height })
      }}
    >
      <View
        onLayout={(e) => setAltoTarjeta(e.nativeEvent.layout.height)}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            width: ancho,
            top: top ?? 0,
            left: pantalla ? (pantalla.width - ancho) / 2 : GUTTER,
            maxHeight: pantalla ? pantalla.height - insets.top - insets.bottom - MARGEN * 2 : undefined,
            // Oculta hasta conocer su tamaño y posición, para no "saltar".
            opacity: top == null ? 0 : 1,
          },
        ]}
      >
        <Text style={[styles.texto, { color: theme.text, fontSize: tamanoOutdoor(15) }]}>
          {currentStep?.text}
        </Text>
        <Text style={[styles.pista, { color: theme.textDim }]}>
          Tocá en cualquier lugar para {isLastStep ? 'terminar' : 'continuar'}
        </Text>
        <View style={styles.acciones}>
          {!isLastStep ? (
            <Pressable onPress={() => void stop()} hitSlop={8} style={styles.btnSecundario}>
              <Text style={[styles.btnTexto, { color: theme.textDim }]}>{labels.skip}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.accionesDerecha}>
            {!isFirstStep ? (
              <Pressable onPress={() => void goToPrev()} hitSlop={8} style={styles.btnSecundario}>
                <Text style={[styles.btnTexto, { color: theme.text }]}>{labels.previous}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={avanzar}
              style={[styles.btnPrimario, { backgroundColor: theme.accent }]}
              hitSlop={8}
            >
              <Text style={[styles.btnTexto, { color: theme.onAccent }]}>
                {isLastStep ? labels.finish : labels.next}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  texto: {
    lineHeight: 22,
    fontWeight: '500',
  },
  pista: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accionesDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btnSecundario: {
    paddingVertical: 8,
  },
  btnPrimario: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
})
