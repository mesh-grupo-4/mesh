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
const SLIDE_DISTANCE = 68;
const SELECT_THRESHOLD = 0.72;

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
  const pressed = useSharedValue(0);
  const holdStart = useSharedValue(0);
  const totalMovement = useSharedValue(0);

  const navigateCrear = () => {
    router.push('/viaje/crear');
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
    })
    .onUpdate((e) => {
      totalMovement.value = Math.hypot(e.translationX, e.translationY);
      const elapsed = Date.now() - holdStart.value;

      if (elapsed >= HOLD_MS) {
        if (menuOpen.value < 1) {
          menuOpen.value = withTiming(1, { duration: 180 });
        }
        const progress = Math.min(1, Math.max(0, -e.translationY / SLIDE_DISTANCE));
        slideProgress.value = progress;
      }
    })
    .onFinalize(() => {
      const wasHold = Date.now() - holdStart.value >= HOLD_MS;
      const selected = slideProgress.value >= SELECT_THRESHOLD;

      if (wasHold && selected) {
        runOnJS(navigateCrear)();
      } else if (!wasHold && totalMovement.value < 14) {
        runOnJS(tapViajes)();
      }

      menuOpen.value = withTiming(0, { duration: 160 });
      slideProgress.value = withTiming(0, { duration: 160 });
      pressed.value = withTiming(0, { duration: 160 });
    });

  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value,
    transform: [
      {
        translateY:
          interpolate(menuOpen.value, [0, 1], [24, 0]) +
          interpolate(slideProgress.value, [0, 1], [10, 0]),
      },
      { scale: interpolate(menuOpen.value, [0, 1], [0.88, 1]) },
    ],
  }));

  const optionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      slideProgress.value,
      [0, SELECT_THRESHOLD, 1],
      [Colors.dark.surface, Colors.dark.surface, Colors.dark.accent]
    ),
    borderColor: interpolateColor(
      slideProgress.value,
      [0, SELECT_THRESHOLD, 1],
      [Colors.dark.accentLine, Colors.dark.accentLine, Colors.dark.accent]
    ),
    transform: [{ scale: interpolate(slideProgress.value, [0, 1], [1, 1.05]) }],
  }));

  const optionTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      slideProgress.value,
      [0, SELECT_THRESHOLD, 1],
      [Colors.dark.accent, Colors.dark.accent, Colors.dark.onAccent]
    ),
  }));

  const trackStyle = useAnimatedStyle(() => ({
    height: interpolate(slideProgress.value, [0, 1], [6, 42]),
    opacity: menuOpen.value * interpolate(slideProgress.value, [0, 0.15, 1], [0.25, 0.55, 1]),
  }));

  const hintSlideStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value * (1 - Math.min(1, slideProgress.value * 2.5)),
  }));

  const iconAccentStyle = useAnimatedStyle(() => ({
    opacity: slideProgress.value >= SELECT_THRESHOLD ? 0 : 1,
  }));

  const iconOnAccentStyle = useAnimatedStyle(() => ({
    opacity: slideProgress.value >= SELECT_THRESHOLD ? 1 : 0,
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
        accessibilityHint="Mantené apretado y deslizá hacia arriba para crear un viaje nuevo"
        testID={testID}
      >
        <Animated.View style={[styles.menuStack, menuStyle]} pointerEvents="none">
          <Animated.View
            style={[
              styles.option,
              {
                shadowColor: Colors.dark.accent,
              },
              optionStyle,
            ]}
          >
            <View style={styles.optionIconWrap}>
              <Animated.View style={[styles.optionIconLayer, iconAccentStyle]}>
                <Feather name="plus" size={16} color={Colors.dark.accent} />
              </Animated.View>
              <Animated.View style={[styles.optionIconLayer, iconOnAccentStyle]}>
                <Feather name="plus" size={16} color={Colors.dark.onAccent} />
              </Animated.View>
            </View>
            <Animated.Text style={[styles.optionText, optionTextStyle]}>Nuevo viaje</Animated.Text>
          </Animated.View>

          <Animated.Text style={[styles.slideHint, { color: Colors.dark.textMute }, hintSlideStyle]}>
            Deslizá hacia arriba
          </Animated.Text>

          <Animated.View
            style={[styles.track, { backgroundColor: Colors.dark.accentLine }, trackStyle]}
          />
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
    width: 160,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
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
    fontSize: 14,
    fontWeight: '700',
  },
  optionIconWrap: {
    width: 16,
    height: 16,
  },
  optionIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  track: {
    width: 2,
    borderRadius: 1,
    marginTop: 6,
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
