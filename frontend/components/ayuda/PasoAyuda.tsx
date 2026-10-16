import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useIsFocused } from 'expo-router'
import { CopilotStep, walkthroughable } from 'react-native-copilot'

const ViewAyuda = walkthroughable(View)

type Props = {
  /** Id único del paso en toda la app (ver rangos en `contenidoAyuda.ts`). */
  nombre: string
  orden: number
  texto: string
  /** Para excluir el paso del tour sin desenfocar la pantalla (ej. un bottom-sheet
   * abierto encima). Por defecto `true`. */
  activo?: boolean
  /**
   * Estilo del wrapper que este componente inserta. El wrapper es un `View` de
   * flujo normal sin tamaño propio: si lo que envolvés tiene `position:
   * 'absolute'` en su propia raíz (botones flotantes, headers superpuestos al
   * mapa) o depende de `flex: 1` del padre (un mapa a pantalla completa), hay
   * que repetir ese mismo `flex`/`position` acá — si no, el wrapper colapsa a
   * tamaño 0 y el elemento envuelto pierde su posición o desaparece.
   */
  estilo?: StyleProp<ViewStyle>
  pointerEvents?: 'auto' | 'box-none'
  children: React.ReactElement
}

/**
 * Envuelve un elemento para que el botón de ayuda ("?") lo resalte en el tour.
 *
 * react-native-copilot guarda un registro global de pasos montados, y Expo
 * Router no siempre desmonta pantallas en background (tabs, stacks). Sin esto,
 * un tour podría arrastrar pasos de otra pantalla que sigue montada detrás.
 * `active={enfocado && activo}` evita que el paso se registre mientras esta
 * pantalla no está en foco.
 */
export function PasoAyuda({ nombre, orden, texto, activo = true, estilo, pointerEvents, children }: Props) {
  const enfocado = useIsFocused()
  return (
    <CopilotStep name={nombre} order={orden} text={texto} active={enfocado && activo}>
      <ViewAyuda style={estilo} pointerEvents={pointerEvents}>
        {children}
      </ViewAyuda>
    </CopilotStep>
  )
}
