import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/components/MeshUI';
import { abrirNuevoViaje } from '@/lib/nuevoViaje';

const HOLD_MS = 280;
const SLIDE_DISTANCE = 64;
const SELECT_THRESHOLD = 0.6;
const UP_DEADZONE = 6;
const X_DEADZONE = 8;
/** Mismo blanco que el resto de las pestañas inactivas (`tabBarInactiveTintColor`). */
const BLANCO_INACTIVO = '#ffffff';

/**
 * Botón de Inicio (mapa), primero de la tab bar. Se ve como las demás pestañas:
 * naranja solo cuando está activo. Tap → Inicio. Mantener y deslizar a la
 * izquierda → "Nuevo viaje" (pregunta Viaje YA / Planificar); a la derecha →
 * escanear un QR para unirse.
 */
export function CenterInicioTabButton({
  onPress,
  accessibilityState,
  'aria-selected': ariaSelected,
  accessibilityLabel,
  testID,
}: BottomTabBarButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  // La tab bar informa la pestaña activa con `aria-selected`.
  const focused = ariaSelected ?? accessibilityState?.selected ?? false;

  const menuOpen = useSharedValue(0);
  const slideProgress = useSharedValue(0);
  // -1 = opción izquierda (nuevo viaje), 1 = opción derecha (escanear QR), 0 = ninguna.
  const activeSide = useSharedValue(0);
  const pressed = useSharedValue(0);
  const holdStart = useSharedValue(0);
  const totalMovement = useSharedValue(0);

  // Timer para abrir el menú apenas se cumple el hold, sin depender de que el dedo se mueva.
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHoldTimer = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      menuOpen.value = withTiming(1, { duration: 180 });
    }, HOLD_MS);
  };

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  React.useEffect(() => clearHoldTimer, []);

  const navigateCrear = () => {
    abrirNuevoViaje();
  };

  const navigateEscanear = () => {
    router.push('/escanear-qr');
  };

  const tapInicio = () => {
    onPress?.(undefined as unknown as Parameters<NonNullable<typeof onPress>>[0]);
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      holdStart.value = Date.now();
      totalMovement.value = 0;
      pressed.value = withTiming(1, { duration: 140 });
      runOnJS(armHoldTimer)();
    })
    .onUpdate((e) => {
      totalMovement.value = Math.hypot(e.translationX, e.translationY);
      const elapsed = Date.now() - holdStart.value;

      if (elapsed >= HOLD_MS) {
        if (menuOpen.value < 1) {
          menuOpen.value = withTiming(1, { duration: 180 });
        }

        const up = -e.translationY;
        if (up > UP_DEADZONE && Math.abs(e.translationX) > X_DEADZONE) {
          activeSide.value = e.translationX < 0 ? -1 : 1;
          const dist = Math.hypot(e.translationX, e.translationY);
          slideProgress.value = Math.min(1, dist / SLIDE_DISTANCE);
        } else {
          activeSide.value = 0;
          slideProgress.value = 0;
        }
      }
    })
    .onFinalize(() => {
      runOnJS(clearHoldTimer)();
      const wasHold = Date.now() - holdStart.value >= HOLD_MS;
      const confirmed = slideProgress.value >= SELECT_THRESHOLD && activeSide.value !== 0;

      if (wasHold && confirmed) {
        if (activeSide.value === -1) {
          runOnJS(navigateCrear)();
        } else {
          runOnJS(navigateEscanear)();
        }
      } else if (!wasHold && totalMovement.value < 14) {
        runOnJS(tapInicio)();
      }

      menuOpen.value = withTiming(0, { duration: 160 });
      slideProgress.value = withTiming(0, { duration: 160 });
      activeSide.value = 0;
      pressed.value = withTiming(0, { duration: 160 });
    });

  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value,
    transform: [
      { translateY: interpolate(menuOpen.value, [0, 1], [24, 0]) },
      { scale: interpolate(menuOpen.value, [0, 1], [0.88, 1]) },
    ],
  }));

  // sel = progreso del deslizamiento cuando el dedo apunta a ese lado; si no, 0.
  const leftStyle = useAnimatedStyle(() => {
    const sel = activeSide.value === -1 ? slideProgress.value : 0;
    return {
      backgroundColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [theme.surface, theme.surface, theme.accent]
      ),
      borderColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [theme.accentLine, theme.accentLine, theme.accent]
      ),
      transform: [{ scale: interpolate(sel, [0, 1], [1, 1.06]) }],
    };
  });
  const rightStyle = useAnimatedStyle(() => {
    const sel = activeSide.value === 1 ? slideProgress.value : 0;
    return {
      backgroundColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [theme.surface, theme.surface, theme.accent]
      ),
      borderColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [theme.accentLine, theme.accentLine, theme.accent]
      ),
      transform: [{ scale: interpolate(sel, [0, 1], [1, 1.06]) }],
    };
  });
  const leftTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSide.value === -1 ? slideProgress.value : 0,
      [0, SELECT_THRESHOLD, 1],
      [theme.accent, theme.accent, theme.onAccent]
    ),
  }));
  const rightTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSide.value === 1 ? slideProgress.value : 0,
      [0, SELECT_THRESHOLD, 1],
      [theme.accent, theme.accent, theme.onAccent]
    ),
  }));
  const leftIconAccentStyle = useAnimatedStyle(() => ({
    opacity: activeSide.value === -1 && slideProgress.value >= SELECT_THRESHOLD ? 0 : 1,
  }));
  const leftIconOnAccentStyle = useAnimatedStyle(() => ({
    opacity: activeSide.value === -1 && slideProgress.value >= SELECT_THRESHOLD ? 1 : 0,
  }));
  const rightIconAccentStyle = useAnimatedStyle(() => ({
    opacity: activeSide.value === 1 && slideProgress.value >= SELECT_THRESHOLD ? 0 : 1,
  }));
  const rightIconOnAccentStyle = useAnimatedStyle(() => ({
    opacity: activeSide.value === 1 && slideProgress.value >= SELECT_THRESHOLD ? 1 : 0,
  }));

  const hintSlideStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value * (1 - Math.min(1, slideProgress.value * 2.5)),
  }));

  const contenidoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
  }));
  const colorItem = focused ? theme.accent : BLANCO_INACTIVO;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.wrapper}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel ?? 'Inicio'}
        accessibilityHint="Mantené apretado y deslizá a la izquierda para crear un viaje nuevo, o a la derecha para escanear un QR y unirte"
        testID={testID}
      >
        <Animated.View style={[styles.menuStack, menuStyle]} pointerEvents="none">
          <View style={styles.optionsRow}>
            <Animated.View
              style={[styles.option, { shadowColor: theme.accent }, leftStyle]}
            >
              <View style={styles.optionIconWrap}>
                <Animated.View style={[styles.optionIconLayer, leftIconAccentStyle]}>
                  <Feather name="plus" size={15} color={theme.accent} />
                </Animated.View>
                <Animated.View style={[styles.optionIconLayer, leftIconOnAccentStyle]}>
                  <Feather name="plus" size={15} color={theme.onAccent} />
                </Animated.View>
              </View>
              <Animated.Text style={[styles.optionText, leftTextStyle]}>Nuevo viaje</Animated.Text>
            </Animated.View>

            <Animated.View
              style={[styles.option, { shadowColor: theme.accent }, rightStyle]}
            >
              <View style={styles.optionIconWrap}>
                <Animated.View style={[styles.optionIconLayer, rightIconAccentStyle]}>
                  <FontAwesome name="qrcode" size={15} color={theme.accent} />
                </Animated.View>
                <Animated.View style={[styles.optionIconLayer, rightIconOnAccentStyle]}>
                  <FontAwesome name="qrcode" size={15} color={theme.onAccent} />
                </Animated.View>
              </View>
              <Animated.Text style={[styles.optionText, rightTextStyle]}>Escanear QR</Animated.Text>
            </Animated.View>
          </View>

          <Animated.Text
            style={[styles.slideHint, { color: theme.textMute }, hintSlideStyle]}
          >
            Deslizá a una opción
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.contenido, contenidoStyle]}>
          <View style={styles.icono}>
            <FontAwesome name="home" size={20} color={colorItem} />
          </View>
          <Text style={[styles.label, { color: colorItem }]}>Inicio</Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  // Inicio va pegado al borde izquierdo: el menú arranca ahí y se abre hacia la derecha
  // (centrado sobre el botón se cortaría contra el borde de la pantalla).
  menuStack: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    alignItems: 'center',
    width: 260,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionIconWrap: {
    width: 15,
    height: 15,
  },
  optionIconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
  },
  contenido: {
    alignItems: 'center',
  },
  // Misma altura que el ícono de las otras pestañas.
  icono: {
    height: 22,
    marginTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
