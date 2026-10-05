import * as Haptics from 'expo-haptics'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * Lista de paradas reordenable: cada parada es una tarjeta independiente que se
 * mueve manteniendo presionada su manija ({@link ManijaArrastre}) y arrastrándola.
 * Al soltar se informa el índice de origen y el de destino.
 */

const DEMORA_LONG_PRESS_MS = 300
const DURACION_ANIM_MS = 160

const ManijaContext = createContext<PanGesture | null>(null)

/** Zona de la tarjeta que inicia el arrastre al mantenerla presionada. */
export function ManijaArrastre({ children }: { children: ReactNode }) {
  const gesto = useContext(ManijaContext)
  if (!gesto) return <>{children}</>
  return (
    <GestureDetector gesture={gesto}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  )
}

type Props<T extends { id: string }> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  onReordenar: (desde: number, hasta: number) => void
  onArrastreChange?: (activo: boolean) => void
  /** Posición vertical de cada tarjeta dentro de la lista (para hacer scroll hasta ella). */
  onItemLayout?: (id: string, y: number) => void
  deshabilitado?: boolean
}

export function ParadasReordenables<T extends { id: string }>({
  items,
  renderItem,
  onReordenar,
  onArrastreChange,
  onItemLayout,
  deshabilitado = false,
}: Props<T>) {
  const alturas = useSharedValue<number[]>([])
  const activo = useSharedValue(-1)
  const destino = useSharedValue(-1)
  const dy = useSharedValue(0)

  const terminar = (desde: number, hasta: number) => {
    onArrastreChange?.(false)
    if (desde >= 0 && hasta >= 0 && desde !== hasta) onReordenar(desde, hasta)
    // Se resetea después del reorden para que la tarjeta no "salte" a su lugar viejo.
    requestAnimationFrame(() => {
      activo.value = -1
      destino.value = -1
      dy.value = 0
    })
  }

  const empezar = () => {
    onArrastreChange?.(true)
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  return (
    <View>
      {items.map((item, index) => (
        <ItemArrastrable
          key={item.id}
          index={index}
          total={items.length}
          alturas={alturas}
          activo={activo}
          destino={destino}
          dy={dy}
          deshabilitado={deshabilitado || items.length < 2}
          onEmpezar={empezar}
          onTerminar={terminar}
          onLayoutY={(y) => onItemLayout?.(item.id, y)}
        >
          {renderItem(item, index)}
        </ItemArrastrable>
      ))}
    </View>
  )
}

type ItemProps = {
  index: number
  total: number
  alturas: SharedValue<number[]>
  activo: SharedValue<number>
  destino: SharedValue<number>
  dy: SharedValue<number>
  deshabilitado: boolean
  onEmpezar: () => void
  onTerminar: (desde: number, hasta: number) => void
  onLayoutY: (y: number) => void
  children: ReactNode
}

function ItemArrastrable({
  index,
  total,
  alturas,
  activo,
  destino,
  dy,
  deshabilitado,
  onEmpezar,
  onTerminar,
  onLayoutY,
  children,
}: ItemProps) {
  const gesto = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!deshabilitado)
        .activateAfterLongPress(DEMORA_LONG_PRESS_MS)
        .onStart(() => {
          activo.value = index
          destino.value = index
          dy.value = 0
          runOnJS(onEmpezar)()
        })
        .onUpdate((e) => {
          dy.value = e.translationY
          // Destino: cuántas tarjetas vecinas se pasaron por más de la mitad de su alto.
          const h = alturas.value
          let t = index
          let acc = 0
          if (e.translationY > 0) {
            for (let i = index + 1; i < total; i++) {
              const hi = h[i] ?? 0
              if (e.translationY > acc + hi / 2) {
                t = i
                acc += hi
              } else break
            }
          } else {
            for (let i = index - 1; i >= 0; i--) {
              const hi = h[i] ?? 0
              if (-e.translationY > acc + hi / 2) {
                t = i
                acc += hi
              } else break
            }
          }
          destino.value = t
        })
        .onFinalize(() => {
          if (activo.value !== index) return
          // Lleva la tarjeta a su hueco final antes de reordenar.
          const h = alturas.value
          const hasta = destino.value
          let offset = 0
          if (hasta > index) for (let i = index + 1; i <= hasta; i++) offset += h[i] ?? 0
          else for (let i = hasta; i < index; i++) offset -= h[i] ?? 0
          dy.value = withTiming(offset, { duration: DURACION_ANIM_MS }, () => {
            runOnJS(onTerminar)(index, hasta)
          })
        }),
    [index, total, deshabilitado, alturas, activo, destino, dy, onEmpezar, onTerminar]
  )

  const estilo = useAnimatedStyle(() => {
    const a = activo.value
    if (a === -1) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1 }
    if (a === index) {
      return { transform: [{ translateY: dy.value }, { scale: 1.02 }], zIndex: 10, opacity: 0.95 }
    }
    const hActivo = alturas.value[a] ?? 0
    const d = destino.value
    let shift = 0
    if (a < index && index <= d) shift = -hActivo
    else if (d <= index && index < a) shift = hActivo
    return {
      transform: [{ translateY: withTiming(shift, { duration: DURACION_ANIM_MS }) }, { scale: 1 }],
      zIndex: 0,
      opacity: 1,
    }
  })

  return (
    <Animated.View
      style={[styles.item, estilo]}
      onLayout={(e) => {
        const alto = e.nativeEvent.layout.height
        onLayoutY(e.nativeEvent.layout.y)
        const copia = [...alturas.value]
        copia[index] = alto
        alturas.value = copia
      }}
    >
      <ManijaContext.Provider value={gesto}>{children}</ManijaContext.Provider>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // El espaciado va como padding (no margin) para que entre en el alto medido.
  item: {
    paddingBottom: 8,
  },
})
