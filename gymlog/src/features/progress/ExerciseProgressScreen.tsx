import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LineChart } from '@/components/ui/LineChart';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import { PR_KIND_LABELS } from '@/constants/enums';
import { calculateExerciseProgress, type ExerciseProgress } from '@/analytics/progression';
import { detectPlateau, type PlateauResult } from '@/analytics/plateau';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { StatsRepository } from '@/repositories/StatsRepository';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import type { ExerciseDetail, PersonalRecord } from '@/types/domain';
import { formatDateRu, plural } from '@/utils/date';
import { formatInt, formatPercent } from '@/utils/format';
import { formatDecimal, formatWeight, fromKg } from '@/utils/units';

type Metric = 'weight' | 'e1rm' | 'volume' | 'reps';

export function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const settings = useSettingsStore((s) => s.settings);

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [plateau, setPlateau] = useState<PlateauResult | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [metric, setMetric] = useState<Metric>('weight');

  useEffect(() => {
    if (!id) return;
    ExerciseRepository.getById(id).then(setExercise);
    PersonalRecordRepository.listByExercise(id, 20).then(setRecords);
    StatsRepository.exerciseSessionPoints(id, 100).then((points) => {
      setProgress(calculateExerciseProgress(points));
      setPlateau(detectPlateau(points, Date.now()));
    });
  }, [id]);

  if (!progress || !exercise) {
    return (
      <Screen>
        <Txt tone="muted">Загрузка…</Txt>
      </Screen>
    );
  }

  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  const series =
    metric === 'weight' ? progress.maxWeight
    : metric === 'e1rm' ? progress.est1rm
    : metric === 'volume' ? progress.volume
    : progress.reps;

  const needsUnit = metric !== 'reps';
  const data = series.map((point) => ({
    x: point.x,
    y: needsUnit ? fromKg(point.y, settings.unit) : point.y,
  }));

  return (
    <Screen scroll>
      <Txt variant="h2">{exercise.nameRu}</Txt>
      <Txt tone="muted" style={styles.subtitle}>
        {progress.sessionCount} {plural(progress.sessionCount, 'выполнение', 'выполнения', 'выполнений')}
        {progress.firstAt ? ` · с ${formatDateRu(progress.firstAt)}` : ''}
      </Txt>

      <View style={styles.tiles}>
        <StatTile label="Максимальный вес" value={formatWeight(progress.bestWeightKg, settings.unit)} />
        <StatTile
          label="Лучший 1ПМ"
          value={formatWeight(progress.bestEst1rmKg, settings.unit)}
          hint="формула Эпли"
        />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Лучший объём подхода" value={formatInt(progress.bestSetVolumeKg)} hint="кг" />
        <StatTile label="Общий объём" value={formatInt(progress.totalVolumeKg)} hint="кг" />
      </View>

      {progress.est1rmChangePct !== null ? (
        <Card style={styles.block}>
          <Txt variant="label" tone="faint">Изменение за всё время</Txt>
          <Txt variant="small">
            Рабочий вес: {progress.weightChangePct !== null ? formatPercent(progress.weightChangePct) : '—'} ·{' '}
            Расчётный 1ПМ: {formatPercent(progress.est1rmChangePct)} ·{' '}
            Объём: {progress.volumeChangePct !== null ? formatPercent(progress.volumeChangePct) : '—'}
          </Txt>
          {plateau?.isPlateau ? (
            <Txt variant="small" tone="warn">
              Похоже на застой: за последние {plateau.sessionsAnalyzed} выполнений заметного роста нет.
              {plateau.daysSinceBest !== null ? ` Лучший результат был ${plateau.daysSinceBest} дн. назад.` : ''}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.segments}>
        <SegmentedControl<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'weight', label: 'Вес' },
            { value: 'e1rm', label: '1ПМ' },
            { value: 'volume', label: 'Объём' },
            { value: 'reps', label: 'Повторы' },
          ]}
        />
      </View>

      <Card style={styles.block}>
        <LineChart
          width={chartWidth}
          data={data}
          formatValue={(value) => (metric === 'volume' ? formatInt(value) : formatDecimal(value, 1))}
        />
      </Card>

      {records.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>История рекордов</Txt>
          {records.map((record) => (
            <View key={record.id} style={styles.recordRow}>
              <Txt variant="small" tone="muted">{formatDateRu(record.achievedAt)}</Txt>
              <Txt variant="small" style={styles.flex} numberOfLines={1}>
                {PR_KIND_LABELS[record.kind]}
                {record.repTarget ? ` ×${record.repTarget}` : ''}
              </Txt>
              <Txt variant="small" weight="600" tabular>{formatWeight(record.value, settings.unit)}</Txt>
            </View>
          ))}
        </>
      ) : null}

      <Button
        title="Открыть карточку упражнения"
        variant="secondary"
        fullWidth
        onPress={() => router.push(`/exercise/${exercise.id}`)}
        style={styles.action}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  segments: { marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  flex: { flex: 1 },
  action: { marginTop: spacing.lg },
});
