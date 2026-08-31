import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export interface BarItem {
  label: string;
  value: number;
  caption?: string;
}

interface Props {
  data: BarItem[];
  formatValue?: (value: number) => string;
  emptyText?: string;
}

/** Горизонтальные столбики — для объёма по группам мышц и недельной статистики. */
export function BarChart({ data, formatValue = (v) => String(Math.round(v)), emptyText = 'Нет данных' }: Props) {
  const palette = usePalette();
  const max = data.reduce((acc, item) => Math.max(acc, item.value), 0);

  if (data.length === 0 || max === 0) {
    return <Txt tone="faint" variant="small">{emptyText}</Txt>;
  }

  return (
    <View style={styles.wrapper}>
      {data.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={styles.head}>
            <Txt variant="small" numberOfLines={1} style={styles.label}>{item.label}</Txt>
            <Txt variant="small" tone="muted" tabular>
              {formatValue(item.value)}
              {item.caption ? ` · ${item.caption}` : ''}
            </Txt>
          </View>
          <View style={[styles.track, { backgroundColor: palette.surfaceAlt }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(3, (item.value / max) * 100)}%`, backgroundColor: palette.accent },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  row: { gap: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  label: { flex: 1 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
