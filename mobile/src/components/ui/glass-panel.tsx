import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

// A frosted panel that floats over the liquid backdrop: a translucent fill lets
// the shader colours wash through, a top sheen gives it a lit glass edge, and a
// hairline border + shadow lift it off the background.
export function GlassPanel({ children, style }: Props) {
  const dark = useColorScheme() === 'dark';
  const fill = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';
  const border = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)';
  const sheen = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)';

  return (
    <View style={[styles.panel, { backgroundColor: fill, borderColor: border }, style]}>
      <LinearGradient
        colors={[sheen, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
});
