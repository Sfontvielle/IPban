import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { HIT_SIZE, spacing } from '@/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  value?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}

export function ListRow({ title, subtitle, value, left, right, onPress, destructive, last }: Props) {
  const palette = usePalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: palette.line,
          backgroundColor: pressed && onPress ? palette.surfaceAlt : 'transparent',
        },
      ]}
    >
      {left}
      <View style={styles.text}>
        <Txt variant="body" weight="500" tone={destructive ? 'crit' : 'default'} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" tone="muted" numberOfLines={2}>{subtitle}</Txt>
        ) : null}
      </View>
      {value ? <Txt variant="body" tone="muted" tabular>{value}</Txt> : null}
      {right}
      {onPress && !right && !value ? <Txt tone="faint">›</Txt> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_SIZE + 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: { flex: 1, gap: 2 },
});
