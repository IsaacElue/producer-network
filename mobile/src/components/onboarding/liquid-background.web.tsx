import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { BLOBS_DARK, BLOBS_LIGHT } from '@/components/onboarding/palette';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Web fallback for the Skia liquid backdrop (Skia's shader blur is native-only).
// A static gradient wash approximating the same palette so layout/motion can be
// reviewed in a browser; the real shader depth renders on device.
export function LiquidBackground() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? BLOBS_DARK : BLOBS_LIGHT;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[`${colors[0]}55`, `${theme.background}00`, `${colors[1]}44`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${theme.background}00`, `${colors[2]}44`]}
        start={{ x: 0.5, y: 0.2 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
