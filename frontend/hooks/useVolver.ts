import { useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'

/**
 * Atrás físico o gesto de Android: mientras `activo` sea true y la pantalla
 * tenga el foco, ejecuta `alVolver` en lugar de salir de la pantalla.
 */
export function useAtrasAndroid(activo: boolean, alVolver: () => void) {
  const alVolverRef = useRef(alVolver)
  useEffect(() => {
    alVolverRef.current = alVolver
  })

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !activo) return
      const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
        alVolverRef.current()
        return true
      })
      return () => suscripcion.remove()
    }, [activo])
  )
}

/**
 * Para un paso interno de la pantalla (mapa de selección, segundo paso de un
 * formulario): volver tiene que retroceder ese paso, no abandonar la pantalla.
 * En Android intercepta el atrás; en iOS apaga el deslizamiento desde el borde,
 * que no se puede redirigir a un paso interno, mientras dure el paso.
 */
export function useVolverInterno(activo: boolean, alVolver: () => void) {
  useAtrasAndroid(activo, alVolver)

  const navigation = useNavigation()
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'ios' || !activo) return

      // La primera pantalla de un Stack anidado se cierra con el gesto del Stack
      // padre (viaje/rapido, configurar-ruta): hay que apagarlo en toda la cadena.
      const cadena: { setOptions: (opciones: object) => void }[] = []
      for (let nav: typeof navigation | undefined = navigation; nav; nav = nav.getParent()) {
        cadena.push(nav)
      }
      cadena.forEach((nav) => nav.setOptions({ gestureEnabled: false }))
      return () => cadena.forEach((nav) => nav.setOptions({ gestureEnabled: true }))
    }, [activo, navigation])
  )
}
