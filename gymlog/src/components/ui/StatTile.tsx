import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'crit' | 'accent';
  style?: ViewStyle;
}

export function StatTile({ label, value, hint, tone = 'default', style }: Props) {
  const palette = usePalette();

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: palette.surface, borderColor: palette.line },
        style,
      ]}
    >
      <Txt variant="label" tone="faint" numberOfLines={1}>{label}</Txt>
      <Txt variant="h2" tabular tone={tone === 'default' ? 'default' : tone} numberOfLines={1}>
        {value}
      </Txt>
      {hint ? <Txt variant="caption" tone="muted" numberOfLines={1}>{hint}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 120,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
