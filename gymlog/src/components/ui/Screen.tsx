import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number;
  style?: ViewStyle;
}

export function Screen({ children, scroll = false, padded = true, bottomInset = 0, style }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + bottomInset + spacing.lg;

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: palette.ground }, style]}
        contentContainerStyle={[
          padded ? styles.padded : null,
          { paddingBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: palette.ground }, padded ? styles.padded : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
