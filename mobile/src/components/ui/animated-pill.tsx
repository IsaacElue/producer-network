import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ACCENT, ACCENT_2, GLOW } from '@/components/onboarding/palette';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { moodSurface, useMood } from '@/lib/mood';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

// A selectable pill with physical feedback: a spring scale on press, and a
// spring-driven fill/glow/text transition when it becomes selected. Colours
// come from the active mood when present, else the legacy palette.
export function AnimatedPill({ label, selected, onPress }: Props) {
  const theme = useTheme();
  const mood = useMood();

  const cUnsel = mood ? moodSurface(mood, 1) : theme.backgroundElement;
  const cUnselBorder = mood ? mood.hairline : theme.backgroundSelected;
  const cAccent = mood ? mood.accent : ACCENT;
  const cAccentBorder = mood ? mood.accent : ACCENT_2;
  const cLabelOff = mood ? mood.inkSoft : theme.textSecondary;
  const cLabelOn = mood ? (mood.dark ? '#161311' : '#F4EDDF') : '#ffffff';
  const cGlow = mood ? mood.accent : GLOW;

  const pressed = useSharedValue(0);
  const active = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    active.value = withSpring(selected ? 1 : 0, { damping: 12, stiffness: 180, mass: 0.6 });
  }, [selected, active]);

  const containerStyle = useAnimatedStyle(() => {
    const pop = interpolate(active.value, [0, 0.6, 1], [1, 1.06, 1]);
    const press = interpolate(pressed.value, [0, 1], [1, 0.94]);
    return { transform: [{ scale: pop * press }] };
  });

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.value, [0, 1], [cUnsel, cAccent]),
    borderColor: interpolateColor(active.value, [0, 1], [cUnselBorder, cAccentBorder]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    shadowOpacity: interpolate(active.value, [0, 1], [0, 0.55]),
  }));

  const labelColor = useDerivedValue(() =>
    interpolateColor(active.value, [0, 1], [cLabelOff, cLabelOn]),
  );
  const labelStyle = useAnimatedStyle(() => ({ color: labelColor.value }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 15, stiffness: 220 });
      }}>
      <Animated.View style={[styles.wrap, containerStyle]}>
        <Animated.View
          style={[styles.glow, { backgroundColor: cGlow, shadowColor: cGlow }, glowStyle]}
        />
        <Animated.View style={[styles.fill, fillStyle]}>
          <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 999,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
});
