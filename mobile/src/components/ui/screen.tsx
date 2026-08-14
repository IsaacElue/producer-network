import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

export function Screen({ children, scroll = true }: Props) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        {scroll ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill]}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    // Fills the viewport width. Must NOT center/shrink its child — a centered
    // (unstretched) ScrollView sizes to its content, which stops flex-wrapped
    // pill rows from wrapping and makes the whole page scroll horizontally.
    flex: 1,
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
});
