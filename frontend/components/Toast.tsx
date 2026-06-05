import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type ToastProps = {
  message: string;
  visible: boolean;
  onHide: () => void;
  durationMs?: number;
};

export function Toast({ message, visible, onHide, durationMs = 3000 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(Math.max(0, durationMs - 400)),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    anim.start(() => onHide());
    return () => anim.stop();
  }, [visible, message, durationMs, onHide, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.toast}>
        <Text style={styles.texto}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    zIndex: 100,
  },
  toast: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  texto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
