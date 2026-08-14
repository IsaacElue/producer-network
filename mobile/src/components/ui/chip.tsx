import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { moodSurface, useMood } from '@/lib/mood';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  const theme = useTheme();
  const mood = useMood();

  const bg = mood
    ? selected
      ? mood.accent
      : moodSurface(mood, 1)
    : selected
      ? '#3c87f7'
      : theme.backgroundElement;
  // On a mood, selected chips carry the accent; pick readable text for it.
  const selectedTextColor = mood ? (mood.dark ? '#161311' : '#F4EDDF') : '#ffffff';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
      ]}>
      <ThemedText type="small" style={selected ? { color: selectedTextColor } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
});
