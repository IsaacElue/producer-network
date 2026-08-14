import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { moodSurface, useMood } from '@/lib/mood';

type Props = TextInputProps & {
  label?: string;
};

export function TextField({ label, style, ...rest }: Props) {
  const theme = useTheme();
  const mood = useMood();

  const inputBg = mood ? moodSurface(mood, 1) : theme.backgroundElement;
  const inputColor = mood ? mood.ink : theme.text;
  const placeholder = mood ? mood.faint : theme.textSecondary;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={placeholder}
        style={[
          styles.input,
          { backgroundColor: inputBg, color: inputColor },
          rest.multiline && styles.multiline,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 4,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
