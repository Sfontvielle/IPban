import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MuscleGlyph } from '@/components/ui/MuscleGlyph';
import { Txt } from '@/components/ui/Txt';
import type { IntensityMode, WeightUnit } from '@/constants/enums';
import { SetRow } from '@/features/active-workout/components/SetRow';
import type { SetPatch } from '@/repositories/WorkoutRepository';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { PreviousPerformance, WorkoutExerciseWithSets } from '@/types/domain';
import { formatDayLabel } from '@/utils/date';
import { formatDecimal, fromKg } from '@/utils/units';

interface Props {
  exercise: WorkoutExerciseWithSets;
  previous: PreviousPerformance | null;
  unit: WeightUnit;
  intensityMode: IntensityMode;
  /** Все обработчики стабильны и принимают id — благодаря этому
   *  React.memo реально останавливает перерисовку соседних упражнений. */
  onAddSet: (workoutExerciseId: string) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onToggleSet: (setId: string, restSec: number | null) => void;
  onDeleteSet: (setId: string) => void;
  onRemove: (workoutExerciseId: string) => void;
  onMove: (workoutExerciseId: string, direction: -1 | 1) => void;
}

export const ExerciseBlock = React.memo(function ExerciseBlock({
  exercise,
  previous,
  unit,
  intensityMode,
  onAddSet,
  onPatchSet,
  onToggleSet,
  onDeleteSet,
  onRemove,
  onMove,
}: Props) {
  const palette = usePalette();
  const router = useRouter();

  const handleToggle = useCallback(
    (setId: string) => onToggleSet(setId, exercise.restSec),
    [onToggleSet, exercise.restSec],
  );

  const handleDelete = useCallback(
    (setId: string) =>
      Alert.alert('Удалить подход?', undefined, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => onDeleteSet(setId) },
      ]),
    [onDeleteSet],
  );

  const showMenu = () => {
    Alert.alert(exercise.exerciseName, undefined, [
      { text: 'Техника и история', onPress: () => exercise.exerciseId && router.push(`/exercise/${exercise.exerciseId}`) },
      { text: 'Заменить упражнение', onPress: () => router.push(`/exercise/picker?replaceId=${exercise.id}`) },
      { text: 'Вверх', onPress: () => onMove(exercise.id, -1) },
      { text: 'Вниз', onPress: () => onMove(exercise.id, 1) },
      {
        text: 'Убрать из тренировки',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Убрать упражнение?', 'Записанные подходы этого упражнения будут удалены.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Убрать', style: 'destructive', onPress: () => onRemove(exercise.id) },
          ]),
      },
      { text: 'Закрыть', style: 'cancel' },
    ]);
  };

  const previousSummary = previous
    ? previous.sets
        .slice(0, 4)
        .map((set) =>
          set.weightKg !== null && set.reps !== null
            ? `${formatDecimal(fromKg(set.weightKg, unit))}×${set.reps}`
            : set.durationSec
              ? `${set.durationSec}с`
              : `${set.reps ?? 0}`,
        )
        .join('  ')
    : null;

  return (
    <Card style={styles.card} padded={false}>
      <Pressable onPress={showMenu} style={styles.header}>
        <MuscleGlyph muscle={exercise.primaryMuscle} size={40} />
        <View style={styles.headerText}>
          <Txt variant="body" weight="600" numberOfLines={1}>{exercise.exerciseName}</Txt>
          {previous ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {formatDayLabel(previous.performedAt)}: {previousSummary}
            </Txt>
          ) : (
            <Txt variant="caption" tone="faint">Первое выполнение</Txt>
          )}
        </View>
        <Txt tone="faint" variant="title">⋯</Txt>
      </Pressable>

      <View style={[styles.tableHead, { borderBottomColor: palette.line }]}>
        <Txt variant="caption" tone="faint" style={styles.colIndex}>#</Txt>
        <Txt variant="caption" tone="faint" style={styles.colPrev}>Прошлый</Txt>
        {exercise.metricType !== 'bodyweight_reps' && exercise.metricType !== 'reps_only'
          && exercise.metricType !== 'duration' && exercise.metricType !== 'distance_duration' ? (
          <Txt variant="caption" tone="faint" style={styles.colFlex}>
            {unit === 'kg' ? 'кг' : 'фнт'}
          </Txt>
        ) : null}
        {exercise.metricType !== 'duration' && exercise.metricType !== 'distance_duration' ? (
          <Txt variant="caption" tone="faint" style={styles.colFlex}>повт.</Txt>
        ) : null}
        {exercise.metricType === 'duration' || exercise.metricType === 'weight_duration'
          || exercise.metricType === 'distance_duration' ? (
          <Txt variant="caption" tone="faint" style={styles.colFlex}>сек</Txt>
        ) : null}
        {exercise.metricType === 'distance_duration' ? (
          <Txt variant="caption" tone="faint" style={styles.colFlex}>м</Txt>
        ) : null}
        {intensityMode !== 'off' ? (
          <Txt variant="caption" tone="faint" style={styles.colNarrow}>
            {intensityMode === 'rpe' ? 'RPE' : 'RIR'}
          </Txt>
        ) : null}
        <Txt variant="caption" tone="faint" style={styles.colCheck}>✓</Txt>
      </View>

      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          previous={previous?.sets[set.setIndex - 1]}
          metricType={exercise.metricType}
          unit={unit}
          intensityMode={intensityMode}
          onPatch={onPatchSet}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}

      <Pressable onPress={() => onAddSet(exercise.id)} style={styles.addSet}>
        <Txt variant="small" weight="600" tone="accent">+ Добавить подход</Txt>
      </Pressable>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  headerText: { flex: 1, gap: 2 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colIndex: { width: 26, textAlign: 'center' },
  colPrev: { width: 60 },
  colFlex: { flex: 1, textAlign: 'center' },
  colNarrow: { width: 48, textAlign: 'center' },
  colCheck: { width: 40, textAlign: 'center' },
  addSet: { paddingVertical: spacing.md, alignItems: 'center' },
});
