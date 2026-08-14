import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { moodSurface, useMood } from '@/lib/mood';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const mood = useMood();

  // On a mood ground the base background is transparent (the gradient/backdrop
  // shows through); element/selected surfaces become translucent overlays.
  const backgroundColor = mood
    ? type === 'backgroundElement'
      ? moodSurface(mood, 1)
      : type === 'backgroundSelected'
        ? moodSurface(mood, 2)
        : 'transparent'
    : theme[type ?? 'background'];

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
