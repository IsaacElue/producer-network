import {
  Blur,
  Canvas,
  Circle,
  Fill,
  Group,
  RadialGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { BLOBS_DARK, BLOBS_LIGHT } from '@/components/onboarding/palette';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Ambient liquid backdrop: three saturated blobs drift on slow, offset sine
// paths and the whole group is run through a heavy Skia blur — real
// shader-based depth, not a flat translucent panel. Runs on the UI thread via
// Skia's Reanimated clock, so it stays smooth while the form is interacted with.
export function LiquidBackground() {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? BLOBS_DARK : BLOBS_LIGHT;
  const clock = useClock();

  const r = Math.max(width, height) * 0.5;

  const drift = (bx: number, by: number, sx: number, sy: number, px: number, py: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [
      { translateX: Math.sin(clock.value / sx + px) * width * bx },
      { translateY: Math.cos(clock.value / sy + py) * height * by },
    ]);

  const t0 = drift(0.14, 0.07, 4200, 3600, 0, 0);
  const t1 = drift(0.12, 0.09, 5200, 4700, 1.6, 0.8);
  const t2 = drift(0.16, 0.05, 6000, 3200, 3.1, 2.2);

  const blob = (cx: number, cy: number, color: string) => (
    <Circle c={vec(cx, cy)} r={r}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[`${color}AA`, `${color}00`]} />
    </Circle>
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={theme.background} />
      <Group>
        <Blur blur={70} />
        <Group transform={t0}>{blob(width * 0.22, height * 0.26, colors[0])}</Group>
        <Group transform={t1}>{blob(width * 0.82, height * 0.34, colors[1])}</Group>
        <Group transform={t2}>{blob(width * 0.5, height * 0.9, colors[2])}</Group>
      </Group>
    </Canvas>
  );
}
