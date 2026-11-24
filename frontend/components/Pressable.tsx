import { forwardRef } from 'react'
import {
  Platform,
  Pressable as PressableNativo,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type View,
} from 'react-native'

/** Gris neutro: se ve tanto en el tema claro como en el oscuro. */
const RIPPLE_ANDROID = { color: 'rgba(128, 128, 128, 0.28)', foreground: true } as const
const OPACIDAD_PRESIONADO_IOS = 0.6
/**
 * Espera antes de mostrar el ripple, la misma que usa Android en sus listas (tap timeout).
 * Sin ella, cada vez que el dedo apoya sobre una tarjeta para scrollear, el ripple arrancaba
 * y la tarjeta entera parpadeaba en claro (muy visible en Explorar, con tarjetas grandes).
 * Si el scroll empieza dentro de la espera, el toque se cancela sin ripple; un toque corto
 * igual dispara `onPress`.
 */
const RETRASO_RIPPLE_ANDROID_MS = 100

type Props = PressableProps & {
  /** En false no da respuesta visual: para fondos de modal y tarjetas que solo frenan el toque. */
  feedback?: boolean
}

/**
 * `Pressable` con la respuesta táctil de cada sistema: ripple de Material en
 * Android y atenuación en iOS. Reemplaza al de `react-native` en toda la app.
 *
 * En iOS se respeta el estilo `pressed` de cada componente, y si no tiene, se
 * atenúa. En Android el ripple lo reemplaza, para no sumar dos efectos.
 */
export const Pressable = forwardRef<View, Props>(function Pressable(
  { feedback = true, style, android_ripple, ...props },
  ref
) {
  const interactivo = feedback && !props.disabled && Boolean(props.onPress || props.onLongPress)
  if (!interactivo) return <PressableNativo ref={ref} style={style} {...props} />

  if (Platform.OS === 'android') {
    const estiloAndroid = (estado: PressableStateCallbackType) => {
      const base = typeof style === 'function' ? style({ ...estado, pressed: false }) : style
      // El ripple es rectangular: sin recortarlo se saldría de las esquinas redondeadas.
      return StyleSheet.flatten(base)?.borderRadius ? [{ overflow: 'hidden' as const }, base] : base
    }
    return (
      <PressableNativo
        ref={ref}
        style={estiloAndroid}
        android_ripple={android_ripple ?? RIPPLE_ANDROID}
        unstable_pressDelay={RETRASO_RIPPLE_ANDROID_MS}
        {...props}
      />
    )
  }

  const estiloIos =
    typeof style === 'function'
      ? style
      : ({ pressed }: PressableStateCallbackType) => [
          style,
          pressed && { opacity: OPACIDAD_PRESIONADO_IOS },
        ]
  return <PressableNativo ref={ref} style={estiloIos} {...props} />
})
