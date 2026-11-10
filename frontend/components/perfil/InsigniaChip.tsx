import { Feather } from '@expo/vector-icons'
import { memo, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import type { InsigniaObtenidaApi, RarezaInsigniaApi } from '@/lib/insigniasApi'

type Tema = ReturnType<typeof useTheme>

export const ETIQUETA_RAREZA: Record<RarezaInsigniaApi, string> = {
  comun: 'Común',
  rara: 'Rara',
  epica: 'Épica',
  legendaria: 'Legendaria',
}

const PESO_RAREZA: Record<RarezaInsigniaApi, number> = {
  comun: 0,
  rara: 1,
  epica: 2,
  legendaria: 3,
}

/** RN-078: color principal y de fondo de cada rareza, según el tema activo. */
export function coloresRareza(theme: Tema, rareza: RarezaInsigniaApi) {
  switch (rareza) {
    case 'legendaria':
      return { color: theme.gold, fondo: theme.goldWeak, borde: theme.goldLine }
    case 'epica':
      return { color: theme.epic, fondo: theme.epicWeak, borde: theme.epic }
    case 'rara':
      return { color: theme.rare, fondo: theme.rareWeak, borde: theme.rare }
    default:
      return { color: theme.textDim, fondo: theme.surface2, borde: theme.border }
  }
}

/** Más rara primero; dentro de la misma rareza, la más reciente primero. */
export function ordenarPorRareza(insignias: InsigniaObtenidaApi[]): InsigniaObtenidaApi[] {
  return [...insignias].sort(
    (a, b) =>
      PESO_RAREZA[b.rareza] - PESO_RAREZA[a.rareza] || b.obtenida_at.localeCompare(a.obtenida_at)
  )
}

const ANCHO_CHIP = 96
const PAUSA_BRILLO_MS = 2600
const PASADA_BRILLO_MS = 900

/**
 * Destello diagonal que cruza la insignia cada tanto. Solo en épicas y legendarias,
 * y nunca con "reducir movimiento" activado en el sistema.
 */
function Brillo({ legendaria }: { legendaria: boolean }) {
  const x = useSharedValue(0)

  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PASADA_BRILLO_MS, easing: Easing.inOut(Easing.quad) }),
        withDelay(legendaria ? PAUSA_BRILLO_MS * 0.6 : PAUSA_BRILLO_MS, withTiming(0, { duration: 0 }))
      ),
      -1
    )
    return () => cancelAnimation(x)
  }, [legendaria, x])

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 + x.value * (ANCHO_CHIP + 80) }, { rotate: '20deg' }],
  }))

  return <Animated.View pointerEvents="none" style={[styles.brillo, estilo]} />
}

/** Halo que late suave alrededor del ícono de una insignia legendaria. */
function Halo({ color }: { color: string }) {
  const p = useSharedValue(0)

  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true)
    return () => cancelAnimation(p)
  }, [p])

  const estilo = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.45,
    transform: [{ scale: 1 + p.value * 0.18 }],
  }))

  return <Animated.View pointerEvents="none" style={[styles.halo, { borderColor: color }, estilo]} />
}

type Props = {
  insignia: InsigniaObtenidaApi
  onPress?: (insignia: InsigniaObtenidaApi) => void
}

export const InsigniaChip = memo(function InsigniaChip({ insignia, onPress }: Props) {
  const theme = useTheme()
  const movimientoReducido = useReducedMotion()
  const { color, fondo, borde } = coloresRareza(theme, insignia.rareza)
  const peso = PESO_RAREZA[insignia.rareza]
  const animada = peso >= 2 && !movimientoReducido

  return (
    <Pressable
      onPress={onPress ? () => onPress(insignia) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Insignia ${insignia.nombre}, ${ETIQUETA_RAREZA[insignia.rareza]}`}
      style={[
        styles.chip,
        {
          backgroundColor: peso >= 2 ? fondo : theme.surface,
          borderColor: borde,
          borderWidth: peso >= 2 ? 2 : peso === 1 ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.iconoCaja}>
        {animada && insignia.rareza === 'legendaria' ? <Halo color={color} /> : null}
        <View style={[styles.iconoWrap, { backgroundColor: peso >= 2 ? theme.surface : fondo }]}>
          <Feather name={insignia.icono as keyof typeof Feather.glyphMap} size={20} color={color} />
        </View>
      </View>
      <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={2}>
        {insignia.nombre}
      </Text>
      <Text style={[styles.rareza, { color }]}>{ETIQUETA_RAREZA[insignia.rareza]}</Text>
      {animada ? <Brillo legendaria={insignia.rareza === 'legendaria'} /> : null}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  chip: {
    width: ANCHO_CHIP,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  iconoCaja: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  nombre: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  rareza: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  brillo: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 26,
    height: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
})
