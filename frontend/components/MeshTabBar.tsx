import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Colors from '@/constants/Colors';

/** Radio del arco: un poco más grande que el círculo (28px) para abrazarlo. */
const NOTCH_RADIUS = 32;

export function MeshTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  const borderColor = Colors.dark.border;

  const path = `
    M 0 0
    L ${cx - NOTCH_RADIUS} 0
    A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${cx + NOTCH_RADIUS} 0
    L ${width} 0
  `;

  const notchFill = `
    M ${cx - NOTCH_RADIUS} 0
    A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${cx + NOTCH_RADIUS} 0
    Z
  `;

  return (
    <View style={styles.wrapper}>
      <View style={styles.borderLayer} pointerEvents="none">
        <Svg
          width={width}
          height={NOTCH_RADIUS + 1}
          style={styles.borderSvg}
          viewBox={`0 ${-NOTCH_RADIUS} ${width} ${NOTCH_RADIUS + 1}`}
        >
          <Path d={notchFill} fill={Colors.dark.background} />
          <Path d={path} stroke={borderColor} strokeWidth={1} fill="none" />
        </Svg>
      </View>
      <BottomTabBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
    backgroundColor: Colors.dark.background,
  },
  borderLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 0,
  },
  borderSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
