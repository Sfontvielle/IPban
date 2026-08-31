import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  accent?: boolean;
}

export function Card({ children, onPress, style, padded = true, accent = false }: Props) {
  const palette = usePalette();

  const base: ViewStyle = {
    backgroundColor: accent ? palette.accentSoft : palette.surface,
    borderColor: accent ? 'transparent' : palette.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    padding: padded ? spacing.lg : 0,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { opacity: 0.7 } : null, style]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}
