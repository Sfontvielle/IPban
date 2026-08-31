import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import { PR_KIND_LABELS } from '@/constants/enums';
import { AIAnalysisService } from '@/ai/AIAnalysisService';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { RecoveryRepository } from '@/repositories/RecoveryRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService } from '@/services/WorkoutService';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing } from '@/theme/tokens';
import type { PersonalRecord, RecoveryCheckin, SessionWithContents } from '@/types/domain';
import { formatDateRu, formatDuration, formatTimeRu, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';
import { formatWeight } from '@/utils/units';

const MOOD_LABELS = ['', '😫 плохое', '😐 нормальное', '🙂 хорошее', '🔥 отличное'];

export function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const loadActive = useActiveWorkoutStore((s) => s.load);

  const [session, setSession] = useState<SessionWithContents | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [recovery, setRecovery] = useState<RecoveryCheckin | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;
      WorkoutRepository.getSessionWithContents(sessionId).then(setSession);
      PersonalRecordRepository.listBySession(sessionId).then(setRecords);
      RecoveryRepository.getForSession(sessionId).then(setRecovery);
      AIAnalysisService.getCached(sessionId).then(setAnalysis);
    }, [sessionId]),
  );

  if (!session) {
    return (
      <Screen>
        <Txt tone="muted">Загрузка…</Txt>
      </Screen>
    );
  }

  const requestAnalysis = async () => {
    setLoadingAnalysis(true);
    const result = await AIAnalysisService.analyze(session.id);
    setAnalysis(result.ok ? result.text : result.error);
    setLoadingAnalysis(false);
  };

  const edit = () => {
    Alert.alert(
      'Редактировать тренировку?',
      'Тренировка вернётся в режим записи. После сохранения объём и рекорды будут пересчитаны. ' +
        'Дата и продолжительность не изменятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Редактировать',
          onPress: async () => {
            await WorkoutRepository.reopenSession(session.id);
            await loadActive(session.id);
            router.replace('/workout/active');
          },
        },
      ],
    );
  };

  const remove = () => {
    Alert.alert('Удалить тренировку?', 'Она исчезнет из истории и статистики.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await WorkoutRepository.softDeleteSession(session.id);
          router.back();
        },
      },
    ]);
  };

  const saveAsTemplate = async () => {
    const id = await WorkoutService.saveAsTemplate(session.id, session.title);
    router.push(`/template/${id}`);
  };

  return (
    <Screen scroll>
      <Txt variant="h2">{session.title}</Txt>
      <Txt tone="muted" style={styles.subtitle}>
        {formatDateRu(session.startedAt)}, {formatTimeRu(session.startedAt)}
      </Txt>

      <View style={styles.tiles}>
        <StatTile label="Длительность" value={formatDuration(session.durationSec ?? 0)} />
        <StatTile label="Объём" value={formatInt(session.totalVolumeKg ?? 0)} hint="кг" />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Упражнений" value={String(session.totalExercises ?? 0)} />
        <StatTile label="Подходов" value={String(session.totalSets ?? 0)} hint={`${session.totalReps ?? 0} повторов`} />
      </View>

      {recovery && (recovery.mood || recovery.sleep) ? (
        <Card style={styles.block}>
          <Txt variant="label" tone="faint">Самочувствие</Txt>
          <Txt variant="small">
            {recovery.mood ? `Состояние: ${MOOD_LABELS[recovery.mood]}` : ''}
            {recovery.mood && recovery.sleep ? ' · ' : ''}
            {recovery.sleep ? `Сон: ${'★'.repeat(recovery.sleep)}` : ''}
          </Txt>
        </Card>
      ) : null}

      {records.length > 0 ? (
        <Card accent style={styles.block}>
          <Txt variant="label" tone="accent">
            🏆 {records.length} {plural(records.length, 'рекорд', 'рекорда', 'рекордов')}
          </Txt>
          {records.map((record) => (
            <Txt key={record.id} variant="small">
              {record.exerciseName} — {PR_KIND_LABELS[record.kind]}
              {record.repTarget ? ` ×${record.repTarget}` : ''}: {formatWeight(record.value, settings.unit)}
            </Txt>
          ))}
        </Card>
      ) : null}

      {session.exercises.map((exercise) => {
        const done = exercise.sets.filter((set) => set.isCompleted);
        return (
          <Card key={exercise.id} style={styles.block}>
            <Txt variant="body" weight="600">{exercise.exerciseName}</Txt>
            {done.length === 0 ? (
              <Txt variant="small" tone="faint">Нет выполненных подходов</Txt>
            ) : (
              done.map((set) => (
                <Txt key={set.id} variant="small" tone="muted" tabular>
                  {set.setIndex}.{'  '}
                  {set.weightKg !== null ? `${formatWeight(set.weightKg, settings.unit)} × ` : ''}
                  {set.reps !== null ? `${set.reps}` : ''}
                  {set.durationSec !== null ? `${set.durationSec} с` : ''}
                  {set.rir !== null ? `   RIR ${set.rir}` : ''}
                  {set.rpe !== null ? `   RPE ${set.rpe}` : ''}
                  {set.isPr ? '   🏆' : ''}
                </Txt>
              ))
            )}
            {exercise.notes ? <Txt variant="caption" tone="faint">{exercise.notes}</Txt> : null}
          </Card>
        );
      })}

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">AI-анализ</Txt>
        {analysis ? (
          <Txt variant="small" style={styles.analysis}>{analysis}</Txt>
        ) : (
          <Txt variant="small" tone="muted">
            {settings.aiEnabled ? 'Разбор ещё не запрашивался.' : 'AI выключен в настройках.'}
          </Txt>
        )}
        {settings.aiEnabled ? (
          <Button
            title={analysis ? 'Обновить разбор' : 'Получить разбор'}
            variant="secondary"
            loading={loadingAnalysis}
            onPress={requestAnalysis}
          />
        ) : null}
      </Card>

      <Button title="Сохранить как шаблон" variant="secondary" fullWidth onPress={saveAsTemplate} />
      <Button title="Редактировать тренировку" variant="ghost" fullWidth onPress={edit} style={styles.action} />
      <Button title="Удалить тренировку" variant="danger" fullWidth onPress={remove} style={styles.action} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, gap: spacing.sm },
  analysis: { lineHeight: 21 },
  action: { marginTop: spacing.sm },
});
