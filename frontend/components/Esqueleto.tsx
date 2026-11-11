import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/components/MeshUI';

type Props = {
  ancho?: DimensionValue;
  alto: number;
  radio?: number;
  style?: StyleProp<ViewStyle>;
};

/** Bloque gris que late mientras carga el contenido real. Color plano, sin brillos. */
export function Esqueleto({ ancho = '100%', alto, radio = 8, style }: Props) {
  const theme = useTheme();
  const opacidad = useSharedValue(1);

  useEffect(() => {
    opacidad.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
  }, [opacidad]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      style={[
        { width: ancho, height: alto, borderRadius: radio, backgroundColor: theme.surface2 },
        animado,
        style,
      ]}
    />
  );
}
