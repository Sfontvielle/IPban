import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LineChart } from '@/components/ui/LineChart';
import { Txt } from '@/components/ui/Txt';
import { BodyWeightRepository } from '@/repositories/BodyWeightRepository';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { BodyWeightEntry } from '@/types/domain';
import { formatDateRu } from '@/utils/date';
import { formatDecimal, fromKg, toKg, unitLabel } from '@/utils/units';

export function BodyWeightTab() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const settings = useSettingsStore((s) => s.settings);

  const [entries, setEntries] = useState<BodyWeightEntry[]>([]);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setEntries(await BodyWeightRepository.list(120));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const save = async () => {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSaving(true);
    try {
      await BodyWeightRepository.upsert(toKg(parsed, settings.unit));
      setValue('');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const chartData = [...entries]
    .sort((a, b) => a.measuredAt - b.measuredAt)
    .map((entry) => ({ x: entry.measuredAt, y: fromKg(entry.weightKg, settings.unit) }));

  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const latest = entries[0];
  const previous = entries[1];

  return (
    <View style={styles.wrapper}>
      <Card style={styles.block}>
        <Txt variant="label" tone="faint">Сегодняшний вес</Txt>
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={latest ? formatDecimal(fromKg(latest.weightKg, settings.unit)) : '80,0'}
            placeholderTextColor={palette.inkFaint}
            style={[
              styles.input,
              { backgroundColor: palette.surfaceAlt, color: palette.ink },
            ]}
          />
          <Txt tone="muted">{unitLabel(settings.unit)}</Txt>
          <Button title="Сохранить" onPress={save} loading={saving} disabled={!value} />
        </View>
        {latest && previous ? (
          <Txt variant="caption" tone="muted">
            Изменение с прошлой записи:{' '}
            {formatDecimal(fromKg(latest.weightKg - previous.weightKg, settings.unit))}{' '}
            {unitLabel(settings.unit)}
          </Txt>
        ) : null}
      </Card>

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">Динамика</Txt>
        <LineChart
          width={chartWidth}
          data={chartData}
          formatValue={(v) => formatDecimal(v, 1)}
          emptyText="Добавьте первую запись веса"
        />
      </Card>

      {entries.slice(0, 15).map((entry) => (
        <View key={entry.id} style={[styles.row, { borderBottomColor: palette.line }]}>
          <Txt variant="small" tone="muted">{formatDateRu(entry.measuredAt)}</Txt>
          <Txt variant="body" weight="500" tabular>
            {formatDecimal(fromKg(entry.weightKg, settings.unit))} {unitLabel(settings.unit)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: spacing.lg },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
