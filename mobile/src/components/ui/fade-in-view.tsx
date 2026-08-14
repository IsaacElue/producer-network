import { useEffect, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
};

// Mount-driven fade-and-rise entrance. Uses an animated style (not a layout
// `entering` animation) so it runs identically on native and react-native-web
// — and it's pure Reanimated, no moti/framer-motion in the graph.
export function FadeInView({ children, delay = 0, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 160, mass: 0.7 }));
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [14, 0]) }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
