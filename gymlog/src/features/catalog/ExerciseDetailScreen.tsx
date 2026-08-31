import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { LineChart } from '@/components/ui/LineChart';
import { MuscleGlyph } from '@/components/ui/MuscleGlyph';
import { Screen } from '@/components/ui/Screen';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  EQUIPMENT_LABELS,
  METRIC_TYPE_LABELS,
  MOVEMENT_LABELS,
  MUSCLE_LABELS,
} from '@/constants/enums';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { StatsRepository, type ExerciseSummary } from '@/repositories/StatsRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import type { ExerciseDetail, PreviousPerformance } from '@/types/domain';
import type { ExerciseSessionPoint } from '@/analytics/progression';
import { formatDateRu, formatDayLabel, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';
import { formatWeight, formatWeightValue, fromKg } from '@/utils/units';

export function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const settings = useSettingsStore((s) => s.settings);
  const activeSessionId = useActiveWorkoutStore((s) => s.sessionId);
  const addExercises = useActiveWorkoutStore((s) => s.addExercises);

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [summary, setSummary] = useState<ExerciseSummary | null>(null);
  const [points, setPoints] = useState<ExerciseSessionPoint[]>([]);
  const [history, setHistory] = useState<PreviousPerformance[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      ExerciseRepository.getById(id).then(setExercise);
      StatsRepository.exerciseSummary(id).then(setSummary);
      StatsRepository.exerciseSessionPoints(id, 30).then(setPoints);
      WorkoutRepository.getExerciseHistory(id, 5).then(setHistory);
    }, [id]),
  );

  if (!exercise) {
    return (
      <Screen>
        <Txt tone="muted">Загрузка…</Txt>
      </Screen>
    );
  }

  const overview = exercise.instructions.filter((item) => item.kind === 'overview');
  const steps = exercise.instructions.filter((item) => item.kind === 'step');
  const mistakes = exercise.instructions.filter((item) => item.kind === 'mistake');
  const tips = exercise.instructions.filter((item) => item.kind === 'tip');
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  const addToWorkout = async () => {
    if (!activeSessionId) {
      Alert.alert(
        'Нет активной тренировки',
        'Начните тренировку, чтобы добавить в неё упражнение.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Начать', onPress: () => router.push('/workout/start') },
        ],
      );
      return;
    }
    await addExercises([exercise.id]);
    router.push('/workout/active');
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <MuscleGlyph muscle={exercise.primaryMuscles[0] ?? null} size={64} />
        <View style={styles.headerText}>
          <Txt variant="h2">{exercise.nameRu}</Txt>
          {exercise.nameEn ? <Txt tone="muted">{exercise.nameEn}</Txt> : null}
        </View>
      </View>

      <View style={styles.chips}>
        {exercise.primaryMuscles.map((muscle) => (
          <Chip key={muscle} label={MUSCLE_LABELS[muscle]} tone="accent" />
        ))}
        {exercise.secondaryMuscles.map((muscle) => (
          <Chip key={`s-${muscle}`} label={MUSCLE_LABELS[muscle]} />
        ))}
        {exercise.equipment.map((item) => (
          <Chip key={item} label={EQUIPMENT_LABELS[item]} />
        ))}
      </View>

      <View style={styles.chips}>
        <Chip label={CATEGORY_LABELS[exercise.category]} />
        {exercise.movementPattern ? <Chip label={MOVEMENT_LABELS[exercise.movementPattern]} /> : null}
        {exercise.difficulty ? <Chip label={DIFFICULTY_LABELS[exercise.difficulty]} /> : null}
        <Chip label={exercise.isCompound ? 'Базовое' : 'Изолирующее'} />
        <Chip label={METRIC_TYPE_LABELS[exercise.metricType]} />
      </View>

      <View style={styles.actions}>
        <Button title="Добавить в тренировку" onPress={addToWorkout} style={styles.flex} />
        <Button
          title="Замена"
          variant="secondary"
          onPress={() => router.push(`/exercise/${exercise.id}/substitutes`)}
        />
      </View>
      <Button
        title="Спросить AI об этом упражнении"
        variant="ghost"
        fullWidth
        onPress={() => router.push(`/chat/new?scope=exercise&refId=${exercise.id}`)}
        style={styles.aiButton}
      />

      {summary && summary.sessionCount > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Моя статистика</Txt>
          <View style={styles.tiles}>
            <StatTile
              label="Лучший вес"
              value={summary.bestWeightKg ? formatWeightValue(summary.bestWeightKg, settings.unit) : '—'}
              hint={settings.unit === 'kg' ? 'кг' : 'фнт'}
            />
            <StatTile
              label="Лучший 1ПМ"
              value={summary.bestEst1rmKg ? formatWeightValue(summary.bestEst1rmKg, settings.unit) : '—'}
              hint="расчётный"
            />
          </View>
          <View style={styles.tiles}>
            <StatTile label="Выполнений" value={String(summary.sessionCount)} hint={`${summary.totalSets} подходов`} />
            <StatTile label="Общий объём" value={formatInt(summary.totalVolumeKg)} hint="кг" />
          </View>

          <Card style={styles.block}>
            <Txt variant="label" tone="faint">Рабочий вес по датам</Txt>
            <LineChart
              width={chartWidth}
              data={points.map((point) => ({ x: point.performedAt, y: fromKg(point.maxWeightKg, settings.unit) }))}
              formatValue={(value) => String(Math.round(value * 10) / 10)}
            />
          </Card>

          <Button
            title="Подробный прогресс"
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/stats/${exercise.id}`)}
            style={styles.block}
          />
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Последние выполнения</Txt>
          {history.map((entry) => (
            <Card key={entry.sessionId} style={styles.block}>
              <Txt variant="small" weight="600">{formatDayLabel(entry.performedAt)}</Txt>
              <Txt variant="small" tone="muted">
                {entry.sets
                  .map((set) =>
                    set.weightKg !== null && set.reps !== null
                      ? `${formatWeightValue(set.weightKg, settings.unit)}×${set.reps}`
                      : set.durationSec
                        ? `${set.durationSec} с`
                        : `${set.reps ?? 0} повт.`,
                  )
                  .join('   ')}
              </Txt>
            </Card>
          ))}
        </>
      ) : null}

      {overview.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Техника</Txt>
          {overview.map((item) => (
            <Txt key={item.id} style={styles.paragraph}>{item.text}</Txt>
          ))}
        </>
      ) : null}

      {steps.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Пошагово</Txt>
          {steps.map((item, index) => (
            <View key={item.id} style={styles.step}>
              <Txt variant="small" weight="700" tone="accent" style={styles.stepNumber}>{index + 1}</Txt>
              <Txt variant="small" style={styles.flex}>{item.text}</Txt>
            </View>
          ))}
        </>
      ) : null}

      {mistakes.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Частые ошибки</Txt>
          {mistakes.map((item) => (
            <View key={item.id} style={styles.step}>
              <Txt tone="crit">✕</Txt>
              <Txt variant="small" style={styles.flex}>{item.text}</Txt>
            </View>
          ))}
        </>
      ) : null}

      {tips.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Советы</Txt>
          {tips.map((item) => (
            <View key={item.id} style={styles.step}>
              <Txt tone="ok">✓</Txt>
              <Txt variant="small" style={styles.flex}>{item.text}</Txt>
            </View>
          ))}
        </>
      ) : null}

      {summary && summary.lastPerformedAt ? (
        <Txt variant="caption" tone="faint" style={styles.sectionTitle}>
          Последнее выполнение: {formatDateRu(summary.lastPerformedAt)} ·{' '}
          {summary.sessionCount} {plural(summary.sessionCount, 'раз', 'раза', 'раз')} всего
        </Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  headerText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  aiButton: { marginTop: spacing.sm },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  paragraph: { marginBottom: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  stepNumber: { width: 16 },
});
