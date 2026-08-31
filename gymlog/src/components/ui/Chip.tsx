import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'accent' | 'ok' | 'warn';
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, tone = 'default', style }: Props) {
  const palette = usePalette();

  const background = selected
    ? palette.accent
    : tone === 'ok' ? palette.okSoft
    : tone === 'warn' ? palette.warnSoft
    : tone === 'accent' ? palette.accentSoft
    : palette.surfaceAlt;

  const textTone = selected ? 'inverse' : tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'muted';

  const Wrapper = onPress ? Pressable : React.Fragment;
  const wrapperProps = onPress ? { onPress, accessibilityRole: 'button' as const } : {};

  return (
    <Wrapper {...(wrapperProps as object)}>
      <Txt
        variant="caption"
        tone={textTone}
        weight="600"
        style={[styles.chip, { backgroundColor: background }, style]}
      >
        {label}
      </Txt>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
