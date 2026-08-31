import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BarChart } from '@/components/ui/BarChart';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LineChart } from '@/components/ui/LineChart';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import { MUSCLE_LABELS, type MuscleGroup } from '@/constants/enums';
import { HistoryTab } from '@/features/progress/HistoryTab';
import { BodyWeightTab } from '@/features/progress/BodyWeightTab';
import { bucketByWeek } from '@/analytics/frequency';
import { StatsRepository, type MuscleVolumeRow } from '@/repositories/StatsRepository';
import { spacing } from '@/theme/tokens';
import { periodOfLastDays } from '@/utils/date';
import { formatInt } from '@/utils/format';

type Tab = 'history' | 'progress' | 'body';

export function ProgressScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('history');

  const [weekly, setWeekly] = useState<{ x: number; y: number }[]>([]);
  const [muscles, setMuscles] = useState<MuscleVolumeRow[]>([]);
  const [exercises, setExercises] = useState<{ exerciseId: string; name: string; sessions: number }[]>([]);
  const [summary, setSummary] = useState({ sessions: 0, volumeKg: 0, sets: 0 });

  const reload = useCallback(async () => {
    const now = Date.now();
    const period = periodOfLastDays(56, now);
    const [items, muscleRows, frequent, periodSummary] = await Promise.all([
      StatsRepository.sessionTimestamps(period.fromMs, period.toMs),
      StatsRepository.muscleVolume(periodOfLastDays(28, now).fromMs, now),
      StatsRepository.frequentExercises(1, 30),
      StatsRepository.periodSummary(periodOfLastDays(28, now).fromMs, now),
    ]);
    setWeekly(bucketByWeek(items, 8, now).map((bucket) => ({ x: bucket.weekStart, y: bucket.volumeKg })));
    setMuscles(muscleRows);
    setExercises(frequent);
    setSummary({ sessions: periodSummary.sessions, volumeKg: periodSummary.volumeKg, sets: periodSummary.sets });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'progress') reload();
    }, [reload, tab]),
  );

  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  return (
    <Screen scroll={tab !== 'history'} padded={tab !== 'history'} bottomInset={20}>
      <View style={tab === 'history' ? styles.segmentsInline : undefined}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'history', label: 'История' },
            { value: 'progress', label: 'Прогресс' },
            { value: 'body', label: 'Тело' },
          ]}
        />
      </View>

      {tab === 'history' ? <HistoryTab /> : null}
      {tab === 'body' ? <BodyWeightTab /> : null}

      {tab === 'progress' ? (
        <View style={styles.content}>
          <View style={styles.tiles}>
            <StatTile label="Тренировок за 28 дней" value={String(summary.sessions)} />
            <StatTile label="Объём за 28 дней" value={formatInt(summary.volumeKg)} hint="кг" />
          </View>

          <Card style={styles.block}>
            <Txt variant="label" tone="faint">Объём по неделям</Txt>
            <LineChart
              width={chartWidth}
              data={weekly}
              formatValue={(value) => formatInt(value)}
              emptyText="Проведите тренировку, чтобы увидеть график"
            />
          </Card>

          <Card style={styles.block}>
            <Txt variant="label" tone="faint">Подходы по мышцам за 28 дней</Txt>
            <BarChart
              data={muscles.map((row) => ({
                label: MUSCLE_LABELS[row.muscle as MuscleGroup] ?? row.muscle,
                value: row.sets,
                caption: `${formatInt(row.volumeKg)} кг`,
              }))}
              formatValue={(value) => `${Math.round(value)} подх.`}
              emptyText="Нет данных за период"
            />
          </Card>

          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Прогресс по упражнениям</Txt>
          {exercises.length === 0 ? (
            <EmptyState
              icon="📈"
              title="Пока нечего показать"
              description="После первой тренировки здесь появятся графики по каждому упражнению."
            />
          ) : (
            exercises.map((exercise) => (
              <Card
                key={exercise.exerciseId}
                onPress={() => router.push(`/stats/${exercise.exerciseId}`)}
                style={styles.row}
              >
                <Txt variant="body" weight="500" numberOfLines={1}>{exercise.name}</Txt>
                <Txt variant="caption" tone="muted">{exercise.sessions} выполнений</Txt>
              </Card>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentsInline: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  content: { marginTop: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { marginBottom: spacing.sm, gap: 2 },
});
