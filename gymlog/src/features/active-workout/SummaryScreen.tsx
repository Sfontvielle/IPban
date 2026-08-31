import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import { PR_KIND_LABELS } from '@/constants/enums';
import { AIAnalysisService } from '@/ai/AIAnalysisService';
import { WorkoutService, type WorkoutSummary } from '@/services/WorkoutService';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import { formatDuration, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';
import { formatWeight } from '@/utils/units';

export function SummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);

  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  useEffect(() => {
    if (!sessionId) return;
    WorkoutService.getSummary(sessionId).then(setSummary);
    AIAnalysisService.getCached(sessionId).then((cached) => {
      if (cached) {
        setAnalysis(cached);
        setAnalysisState('done');
      }
    });
  }, [sessionId]);

  const requestAnalysis = async () => {
    if (!sessionId) return;
    setAnalysisState('loading');
    const result = await AIAnalysisService.analyze(sessionId);
    if (result.ok) {
      setAnalysis(result.text);
      setAnalysisState('done');
    } else {
      setAnalysis(result.error);
      setAnalysisState('error');
    }
  };

  useEffect(() => {
    if (settings.aiEnabled && settings.aiAutoAnalysis && summary && analysisState === 'idle') {
      requestAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, settings.aiEnabled, settings.aiAutoAnalysis]);

  if (!summary) {
    return (
      <Screen>
        <Txt tone="muted">Загрузка…</Txt>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Txt variant="h1">Тренировка завершена 💪</Txt>
      <Txt tone="muted" style={styles.subtitle}>{summary.session.title}</Txt>

      <View style={styles.tiles}>
        <StatTile label="Продолжительность" value={formatDuration(summary.durationSec)} />
        <StatTile label="Упражнений" value={String(summary.exercises)} />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Рабочих подходов" value={String(summary.workingSets)} hint={`${summary.totalReps} повторов`} />
        <StatTile label="Объём" value={formatInt(summary.volumeKg)} hint="кг" />
      </View>

      {summary.records.length > 0 ? (
        <Card accent style={styles.block}>
          <Txt variant="label" tone="accent">
            🏆 {summary.records.length} {plural(summary.records.length, 'новый рекорд', 'новых рекорда', 'новых рекордов')}
          </Txt>
          {summary.records.map((record) => (
            <View key={record.id} style={styles.recordRow}>
              <Txt variant="small" weight="500" style={styles.flex} numberOfLines={1}>
                {record.exerciseName}
              </Txt>
              <Txt variant="small" tone="muted" numberOfLines={1}>
                {PR_KIND_LABELS[record.kind]}
                {record.repTarget ? ` ×${record.repTarget}` : ''}
              </Txt>
              <Txt variant="small" weight="600" tabular>
                {formatWeight(record.value, settings.unit)}
              </Txt>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">AI-анализ тренировки</Txt>
        {analysisState === 'loading' ? (
          <Txt variant="small" tone="muted">Читаю ваши данные…</Txt>
        ) : analysis ? (
          <Txt variant="small" style={styles.analysis}>{analysis}</Txt>
        ) : (
          <Txt variant="small" tone="muted">
            {settings.aiEnabled
              ? 'Нажмите, чтобы получить разбор этой тренировки на основе ваших чисел.'
              : 'AI выключен. Включите его в «Настройки → AI-тренер», чтобы получать разбор тренировок.'}
          </Txt>
        )}
        {settings.aiEnabled && analysisState !== 'loading' ? (
          <Button
            title={analysis ? 'Обновить разбор' : 'Получить разбор'}
            variant="secondary"
            onPress={requestAnalysis}
            style={styles.analysisButton}
          />
        ) : null}
      </Card>

      {summary.session.exercises.map((exercise) => {
        const done = exercise.sets.filter((set) => set.isCompleted);
        if (done.length === 0) return null;
        return (
          <Card key={exercise.id} style={styles.block}>
            <Txt variant="body" weight="600" numberOfLines={1}>{exercise.exerciseName}</Txt>
            {done.map((set) => (
              <Txt key={set.id} variant="small" tone="muted" tabular>
                {set.setIndex}.{'  '}
                {set.weightKg !== null ? `${formatWeight(set.weightKg, settings.unit)} × ` : ''}
                {set.reps !== null ? `${set.reps}` : ''}
                {set.durationSec !== null ? `${set.durationSec} с` : ''}
                {set.rir !== null ? `  RIR ${set.rir}` : ''}
                {set.rpe !== null ? `  RPE ${set.rpe}` : ''}
                {set.isPr ? '  🏆' : ''}
              </Txt>
            ))}
          </Card>
        );
      })}

      <Button title="Готово" size="lg" fullWidth onPress={() => router.replace('/')} style={styles.done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  analysis: { lineHeight: 21 },
  analysisButton: { marginTop: spacing.sm },
  done: { marginTop: spacing.lg },
});
