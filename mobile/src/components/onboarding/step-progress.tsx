import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ACCENT_GRADIENT } from '@/components/onboarding/palette';
import { useTheme } from '@/hooks/use-theme';
import { moodSurface, useMood } from '@/lib/mood';

type Props = {
  step: number;
  total: number;
};

// A fluid progress bar: the accent fill springs to step/total, and segment
// ticks mark each step. Recolours to the active mood when present.
export function StepProgress({ step, total }: Props) {
  const theme = useTheme();
  const mood = useMood();
  const [trackWidth, setTrackWidth] = useState(0);
  const fraction = useSharedValue(0);

  const trackColor = mood ? moodSurface(mood, 1) : theme.backgroundElement;
  const tickColor = mood ? mood.gradient[1] : theme.background;
  const fillColors = (
    mood ? [mood.accent, mood.accent] : ACCENT_GRADIENT
  ) as unknown as [string, string];

  useEffect(() => {
    fraction.value = withSpring(Math.min(step / total, 1), {
      damping: 16,
      stiffness: 140,
      mass: 0.7,
    });
  }, [step, total, fraction]);

  const fillStyle = useAnimatedStyle(() => ({ width: trackWidth * fraction.value }));

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.fill, fillStyle]}>
        <LinearGradient
          colors={fillColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.ticks} pointerEvents="none">
        {Array.from({ length: total - 1 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              { left: `${((i + 1) / total) * 100}%`, backgroundColor: tickColor },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  ticks: {
    ...StyleSheet.absoluteFillObject,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
  },
});
