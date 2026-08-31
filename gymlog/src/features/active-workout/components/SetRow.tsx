import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Txt } from '@/components/ui/Txt';
import type { IntensityMode, MetricType, WeightUnit } from '@/constants/enums';
import type { SetPatch } from '@/repositories/WorkoutRepository';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { PreviousPerformance, WorkoutSet } from '@/types/domain';
import { formatClock } from '@/utils/date';
import { formatDecimal, fromKg, toKg } from '@/utils/units';

interface Props {
  set: WorkoutSet;
  previous: PreviousPerformance['sets'][number] | undefined;
  metricType: MetricType;
  unit: WeightUnit;
  intensityMode: IntensityMode;
  onPatch: (patch: SetPatch) => void;
  onToggle: () => void;
  onDelete: () => void;
}

function parseNumber(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const WEIGHT_METRICS: MetricType[] = ['weight_reps', 'weight_duration'];
const ADDED_METRICS: MetricType[] = ['weighted_bodyweight'];
const ASSIST_METRICS: MetricType[] = ['assisted_reps'];
const REPS_METRICS: MetricType[] = [
  'weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_reps', 'reps_only',
];
const TIME_METRICS: MetricType[] = ['duration', 'weight_duration', 'distance_duration'];
const DISTANCE_METRICS: MetricType[] = ['distance_duration'];

export const SetRow = React.memo(function SetRow({
  set,
  previous,
  metricType,
  unit,
  intensityMode,
  onPatch,
  onToggle,
  onDelete,
}: Props) {
  const palette = usePalette();

  const showWeight =
    WEIGHT_METRICS.includes(metricType) ||
    ADDED_METRICS.includes(metricType) ||
    ASSIST_METRICS.includes(metricType);
  const showReps = REPS_METRICS.includes(metricType);
  const showTime = TIME_METRICS.includes(metricType);
  const showDistance = DISTANCE_METRICS.includes(metricType);

  const weightValue = ADDED_METRICS.includes(metricType)
    ? set.addedWeightKg
    : ASSIST_METRICS.includes(metricType)
      ? set.assistKg
      : set.weightKg;

  const [weightText, setWeightText] = useState(
    weightValue === null ? '' : formatDecimal(fromKg(weightValue, unit)),
  );
  const [repsText, setRepsText] = useState(set.reps === null ? '' : String(set.reps));
  const [timeText, setTimeText] = useState(set.durationSec === null ? '' : String(set.durationSec));
  const [distanceText, setDistanceText] = useState(set.distanceM === null ? '' : String(set.distanceM));
  const [intensityText, setIntensityText] = useState(() => {
    const value = intensityMode === 'rpe' ? set.rpe : set.rir;
    return value === null ? '' : String(value);
  });

  // Внешние изменения (например, автозаполнение из прошлой тренировки) подхватываем,
  // но не мешаем вводу: сравниваем с текущим текстом.
  useEffect(() => {
    const next = weightValue === null ? '' : formatDecimal(fromKg(weightValue, unit));
    setWeightText((current) => (parseNumber(current) === parseNumber(next) ? current : next));
  }, [weightValue, unit]);

  const previousLabel = useMemo(() => {
    if (!previous) return '—';
    if (previous.weightKg !== null && previous.reps !== null) {
      return `${formatDecimal(fromKg(previous.weightKg, unit))}×${previous.reps}`;
    }
    if (previous.durationSec) return formatClock(previous.durationSec);
    if (previous.reps !== null) return `${previous.reps}`;
    return '—';
  }, [previous, unit]);

  const commitWeight = (text: string) => {
    const value = parseNumber(text);
    const kg = value === null ? null : toKg(value, unit);
    if (ADDED_METRICS.includes(metricType)) onPatch({ addedWeightKg: kg });
    else if (ASSIST_METRICS.includes(metricType)) onPatch({ assistKg: kg });
    else onPatch({ weightKg: kg });
  };

  const toggle = () => {
    Haptics.impactAsync(
      set.isCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => {});
    onToggle();
  };

  const cycleSetType = () => {
    const next = set.setType === 'working' ? 'warmup' : set.setType === 'warmup' ? 'dropset' : 'working';
    onPatch({ setType: next });
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: set.isCompleted ? 'transparent' : palette.surfaceAlt,
      color: palette.ink,
    },
  ];

  const badgeLabel = set.setType === 'warmup' ? 'Р' : set.setType === 'dropset' ? 'Д' : String(set.setIndex);
  const badgeTone = set.setType === 'warmup' ? 'warn' : set.setType === 'dropset' ? 'accent' : 'muted';

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: set.isCompleted ? palette.okSoft : 'transparent',
          borderBottomColor: palette.line,
        },
      ]}
    >
      <Pressable onPress={cycleSetType} onLongPress={onDelete} hitSlop={8} style={styles.indexCell}>
        <Txt variant="small" weight="700" tone={badgeTone} tabular>{badgeLabel}</Txt>
      </Pressable>

      <View style={styles.previousCell}>
        <Txt variant="caption" tone="faint" tabular numberOfLines={1}>{previousLabel}</Txt>
      </View>

      {showWeight ? (
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          onEndEditing={() => commitWeight(weightText)}
          onBlur={() => commitWeight(weightText)}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={previous?.weightKg !== null && previous?.weightKg !== undefined
            ? formatDecimal(fromKg(previous.weightKg, unit))
            : '—'}
          placeholderTextColor={palette.inkFaint}
          style={inputStyle}
        />
      ) : null}

      {showReps ? (
        <TextInput
          value={repsText}
          onChangeText={setRepsText}
          onEndEditing={() => onPatch({ reps: parseNumber(repsText) })}
          onBlur={() => onPatch({ reps: parseNumber(repsText) })}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder={previous?.reps !== null && previous?.reps !== undefined ? String(previous.reps) : '—'}
          placeholderTextColor={palette.inkFaint}
          style={inputStyle}
        />
      ) : null}

      {showTime ? (
        <TextInput
          value={timeText}
          onChangeText={setTimeText}
          onEndEditing={() => onPatch({ durationSec: parseNumber(timeText) })}
          onBlur={() => onPatch({ durationSec: parseNumber(timeText) })}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="сек"
          placeholderTextColor={palette.inkFaint}
          style={inputStyle}
        />
      ) : null}

      {showDistance ? (
        <TextInput
          value={distanceText}
          onChangeText={setDistanceText}
          onEndEditing={() => onPatch({ distanceM: parseNumber(distanceText) })}
          onBlur={() => onPatch({ distanceM: parseNumber(distanceText) })}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="м"
          placeholderTextColor={palette.inkFaint}
          style={inputStyle}
        />
      ) : null}

      {intensityMode !== 'off' ? (
        <TextInput
          value={intensityText}
          onChangeText={setIntensityText}
          onEndEditing={() =>
            onPatch(
              intensityMode === 'rpe'
                ? { rpe: parseNumber(intensityText) }
                : { rir: parseNumber(intensityText) },
            )
          }
          onBlur={() =>
            onPatch(
              intensityMode === 'rpe'
                ? { rpe: parseNumber(intensityText) }
                : { rir: parseNumber(intensityText) },
            )
          }
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="—"
          placeholderTextColor={palette.inkFaint}
          style={[...inputStyle, styles.narrow]}
        />
      ) : null}

      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.isCompleted }}
        style={[
          styles.check,
          {
            backgroundColor: set.isCompleted ? palette.ok : palette.surfaceAlt,
            borderColor: set.isCompleted ? palette.ok : palette.lineStrong,
          },
        ]}
      >
        <Txt variant="body" weight="700" tone={set.isCompleted ? 'inverse' : 'faint'}>✓</Txt>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  indexCell: { width: 26, alignItems: 'center' },
  previousCell: { width: 60 },
  input: {
    flex: 1,
    minWidth: 48,
    height: 40,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  narrow: { flex: 0, width: 48 },
  check: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
