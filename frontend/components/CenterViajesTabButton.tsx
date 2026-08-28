import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
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
import Colors from '@/constants/Colors';

const HOLD_MS = 280;
const SLIDE_DISTANCE = 64;
const SELECT_THRESHOLD = 0.6;
const UP_DEADZONE = 6;
const X_DEADZONE = 8;

export function CenterViajesTabButton({
  onPress,
  accessibilityState,
  accessibilityLabel,
  testID,
}: BottomTabBarButtonProps) {
  const router = useRouter();
  const focused = accessibilityState?.selected ?? false;

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
    router.push('/viaje/crear');
  };

  const navigateEscanear = () => {
    router.push('/escanear-qr');
  };

  const tapViajes = () => {
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
        runOnJS(tapViajes)();
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
        [Colors.dark.surface, Colors.dark.surface, Colors.dark.accent]
      ),
      borderColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [Colors.dark.accentLine, Colors.dark.accentLine, Colors.dark.accent]
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
        [Colors.dark.surface, Colors.dark.surface, Colors.dark.accent]
      ),
      borderColor: interpolateColor(
        sel,
        [0, SELECT_THRESHOLD, 1],
        [Colors.dark.accentLine, Colors.dark.accentLine, Colors.dark.accent]
      ),
      transform: [{ scale: interpolate(sel, [0, 1], [1, 1.06]) }],
    };
  });
  const leftTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSide.value === -1 ? slideProgress.value : 0,
      [0, SELECT_THRESHOLD, 1],
      [Colors.dark.accent, Colors.dark.accent, Colors.dark.onAccent]
    ),
  }));
  const rightTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSide.value === 1 ? slideProgress.value : 0,
      [0, SELECT_THRESHOLD, 1],
      [Colors.dark.accent, Colors.dark.accent, Colors.dark.onAccent]
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

  const circleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pressed.value, [0, 1], [1, 1.06]),
      },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.wrapper}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel ?? 'Viajes'}
        accessibilityHint="Mantené apretado y deslizá a la izquierda para crear un viaje nuevo, o a la derecha para escanear un QR y unirte"
        testID={testID}
      >
        <Animated.View style={[styles.menuStack, menuStyle]} pointerEvents="none">
          <View style={styles.optionsRow}>
            <Animated.View
              style={[styles.option, { shadowColor: Colors.dark.accent }, leftStyle]}
            >
              <View style={styles.optionIconWrap}>
                <Animated.View style={[styles.optionIconLayer, leftIconAccentStyle]}>
                  <Feather name="plus" size={15} color={Colors.dark.accent} />
                </Animated.View>
                <Animated.View style={[styles.optionIconLayer, leftIconOnAccentStyle]}>
                  <Feather name="plus" size={15} color={Colors.dark.onAccent} />
                </Animated.View>
              </View>
              <Animated.Text style={[styles.optionText, leftTextStyle]}>Nuevo viaje</Animated.Text>
            </Animated.View>

            <Animated.View
              style={[styles.option, { shadowColor: Colors.dark.accent }, rightStyle]}
            >
              <View style={styles.optionIconWrap}>
                <Animated.View style={[styles.optionIconLayer, rightIconAccentStyle]}>
                  <FontAwesome name="qrcode" size={15} color={Colors.dark.accent} />
                </Animated.View>
                <Animated.View style={[styles.optionIconLayer, rightIconOnAccentStyle]}>
                  <FontAwesome name="qrcode" size={15} color={Colors.dark.onAccent} />
                </Animated.View>
              </View>
              <Animated.Text style={[styles.optionText, rightTextStyle]}>Escanear QR</Animated.Text>
            </Animated.View>
          </View>

          <Animated.Text
            style={[styles.slideHint, { color: Colors.dark.textMute }, hintSlideStyle]}
          >
            Deslizá a una opción
          </Animated.Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.circle,
            focused ? styles.circleFocused : styles.circleInactive,
            circleStyle,
          ]}
        >
          <FontAwesome
            name="map"
            size={24}
            color={focused ? Colors.dark.onAccent : Colors.dark.accent}
          />
        </Animated.View>

        <Text
          style={[
            styles.label,
            { color: focused ? Colors.dark.accent : Colors.dark.tabIconDefault },
          ]}
        >
          Viajes
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 2 : 4,
    top: -14,
    zIndex: 2,
  },
  menuStack: {
    position: 'absolute',
    bottom: 78,
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    ...Platform.select({
      ios: {
        shadowColor: Colors.dark.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  circleFocused: {
    backgroundColor: Colors.dark.accent,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  circleInactive: {
    backgroundColor: Colors.dark.accentWeak,
    borderWidth: 2,
    borderColor: Colors.dark.accentLine,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
