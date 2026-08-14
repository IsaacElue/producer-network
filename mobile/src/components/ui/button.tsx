import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMood } from '@/lib/mood';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  const theme = useTheme();
  const mood = useMood();

  let background: string;
  let textColor: string;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (mood) {
    // Primary = inverted ink block (high contrast on any mood); secondary =
    // hairline-outlined ghost; destructive = a muted brick red.
    if (variant === 'primary') {
      background = mood.ink;
      textColor = mood.dark ? '#161311' : '#F4EDDF';
    } else if (variant === 'destructive') {
      background = 'transparent';
      textColor = '#E86A4E';
      borderColor = 'rgba(232,106,78,0.6)';
      borderWidth = 1;
    } else {
      background = 'transparent';
      textColor = mood.ink;
      borderColor = mood.hairline;
      borderWidth = 1;
    }
  } else {
    background =
      variant === 'primary'
        ? '#3c87f7'
        : variant === 'destructive'
          ? '#e5484d'
          : theme.backgroundElement;
    textColor = variant === 'secondary' ? theme.text : '#ffffff';
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor, borderWidth },
        { opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText style={{ color: textColor }}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.three - 4,
    paddingHorizontal: Spacing.four,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
