import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mono, MOODS, Space, type Mood, type MoodKey } from '@/constants/design';
import { MaxContentWidth } from '@/constants/theme';
import { generateAsciiField } from '@/lib/ascii';
import { MoodProvider } from '@/lib/mood';

// Full-bleed generative ASCII texture drawn over nothing (transparent), meant
// to sit between a gradient and the screen content. Tunable density/opacity so
// it reads as texture without fighting the legibility of text on top. Sized to
// the viewport in monospace character cells; pointer-events off.
export function AsciiBackdrop({
  seed,
  color,
  // Calmer defaults for content screens (real headings/body sit on top): the
  // texture stays present but recedes so text keeps high contrast. Screens
  // like auth that are near-empty pass explicit, bolder values.
  density = 0.5,
  opacity = 0.18,
  charSize = 10,
}: {
  seed: string;
  color: string;
  density?: number;
  opacity?: number;
  charSize?: number;
}) {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / (charSize * 0.6)) + 1;
  const rows = Math.ceil(height / charSize) + 1;
  const field = useMemo(
    () => generateAsciiField(seed, cols, rows, density).join('\n'),
    [seed, cols, rows, density],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: Mono,
          fontSize: charSize,
          lineHeight: charSize,
          color,
          opacity,
          includeFontPadding: false,
        }}>
        {field}
      </Text>
    </View>
  );
}

// The reusable screen ground: gradient + ASCII backdrop, with content on top.
// Pick a mood per screen; `seed` varies the texture (default = mood key).
export function MoodBackground({
  mood,
  seed,
  density,
  backdropOpacity,
  charSize,
  children,
}: {
  mood: MoodKey | Mood;
  seed?: string;
  density?: number;
  backdropOpacity?: number;
  charSize?: number;
  children: ReactNode;
}) {
  const m = typeof mood === 'string' ? MOODS[mood] : mood;
  return (
    <MoodProvider value={m}>
      <View style={styles.root}>
        <LinearGradient
          colors={m.gradient as unknown as [string, string]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <AsciiBackdrop
          seed={seed ?? m.key}
          color={m.ascii}
          density={density}
          opacity={backdropOpacity}
          charSize={charSize}
        />
        {children}
      </View>
    </MoodProvider>
  );
}

// MoodBackground + the standard scrolled, safe-area, max-width content column —
// a drop-in replacement for the legacy <Screen> on mood screens.
export function MoodScreen({
  mood,
  seed,
  scroll = true,
  children,
}: {
  mood: MoodKey | Mood;
  seed?: string;
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <MoodBackground mood={mood} seed={seed}>
      <SafeAreaView edges={['top', 'left', 'right']} style={screenStyles.safe}>
        {scroll ? (
          <ScrollView
            style={screenStyles.scroll}
            contentContainerStyle={screenStyles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[screenStyles.content, screenStyles.fill]}>{children}</View>
        )}
      </SafeAreaView>
    </MoodBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

const screenStyles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1, alignSelf: 'stretch' },
  content: {
    padding: Space.md,
    gap: Space.md,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  fill: { flex: 1 },
});
