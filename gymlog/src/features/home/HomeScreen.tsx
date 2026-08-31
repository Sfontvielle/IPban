import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatTile } from '@/components/ui/StatTile';
import { Txt } from '@/components/ui/Txt';
import { PR_KIND_LABELS } from '@/constants/enums';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { StatsRepository, type PeriodSummary } from '@/repositories/StatsRepository';
import { TemplateRepository } from '@/repositories/TemplateRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { InsightService, type Insight } from '@/services/InsightService';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { PersonalRecord, WorkoutSession, WorkoutTemplate } from '@/types/domain';
import { formatDayLabel, formatDuration, periodOfCurrentWeek, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';
import { formatWeight } from '@/utils/units';

export function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const settings = useSettingsStore((s) => s.settings);

  const [week, setWeek] = useState<PeriodSummary | null>(null);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [nextTemplate, setNextTemplate] = useState<WorkoutTemplate | null>(null);

  const reload = useCallback(async () => {
    const period = periodOfCurrentWeek(Date.now(), settings.weekStartsOn);
    const [summary, sessions, active, prs, tips, recentTemplates] = await Promise.all([
      StatsRepository.periodSummary(period.fromMs, period.toMs),
      WorkoutRepository.listSessions(1),
      WorkoutRepository.getActiveSession(),
      PersonalRecordRepository.listRecent(3),
      InsightService.build(),
      TemplateRepository.listRecent(1),
    ]);
    setWeek(summary);
    setLastSession(sessions[0] ?? null);
    setActiveSession(active);
    setRecords(prs);
    setInsights(tips);
    setNextTemplate(recentTemplates[0] ?? null);
  }, [settings.weekStartsOn]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const startWorkout = () => {
    if (activeSession) router.push('/workout/active');
    else router.push('/workout/start');
  };

  return (
    <Screen scroll bottomInset={60}>
      <View style={styles.header}>
        <View>
          <Txt variant="label" tone="faint">Сегодня</Txt>
          <Txt variant="h1">GymLog</Txt>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityLabel="Настройки"
          style={[styles.gear, { backgroundColor: palette.surfaceAlt }]}
        >
          <Txt variant="title">⚙︎</Txt>
        </Pressable>
      </View>

      <Button
        title={activeSession ? 'Продолжить тренировку' : 'Начать тренировку'}
        size="lg"
        fullWidth
        onPress={startWorkout}
        style={styles.cta}
      />

      {nextTemplate && !activeSession ? (
        <Card onPress={() => router.push(`/template/${nextTemplate.id}`)} style={styles.block}>
          <Txt variant="label" tone="faint">Последняя программа</Txt>
          <Txt variant="title">{nextTemplate.name}</Txt>
          <Txt variant="small" tone="muted">
            {nextTemplate.lastUsedAt
              ? `Выполнялась ${formatDayLabel(nextTemplate.lastUsedAt).toLowerCase()}`
              : 'Ещё не выполнялась'}
          </Txt>
        </Card>
      ) : null}

      <View style={styles.tiles}>
        <StatTile
          label="Тренировок за неделю"
          value={String(week?.sessions ?? 0)}
          hint={week ? `${formatDuration(week.durationSec)} всего` : undefined}
        />
        <StatTile label="Объём за неделю" value={week ? formatInt(week.volumeKg) : '0'} hint="кг" />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Рабочих подходов" value={String(week?.sets ?? 0)} />
        <StatTile label="Повторов" value={String(week?.reps ?? 0)} />
      </View>

      {insights.length > 0 ? (
        <Card accent style={styles.block}>
          <Txt variant="label" tone="accent">Анализ</Txt>
          <View style={styles.insights}>
            {insights.map((insight) => (
              <View key={insight.id} style={styles.insightRow}>
                <Txt>{insight.icon}</Txt>
                <Txt variant="small" style={styles.insightText}>{insight.text}</Txt>
              </View>
            ))}
          </View>
          <Pressable onPress={() => router.push('/coach')} hitSlop={8}>
            <Txt variant="small" tone="accent" weight="600" style={styles.link}>
              Спросить AI-тренера →
            </Txt>
          </Pressable>
        </Card>
      ) : null}

      {lastSession ? (
        <Card onPress={() => router.push(`/history/${lastSession.id}`)} style={styles.block}>
          <Txt variant="label" tone="faint">Последняя тренировка</Txt>
          <Txt variant="title">{lastSession.title}</Txt>
          <Txt variant="small" tone="muted">
            {formatDayLabel(lastSession.startedAt)} · {formatDuration(lastSession.durationSec ?? 0)} ·{' '}
            {lastSession.totalExercises ?? 0}{' '}
            {plural(lastSession.totalExercises ?? 0, 'упражнение', 'упражнения', 'упражнений')} ·{' '}
            {formatInt(lastSession.totalVolumeKg ?? 0)} кг
          </Txt>
        </Card>
      ) : null}

      {records.length > 0 ? (
        <Card style={styles.block} padded={false}>
          <View style={styles.cardHead}>
            <Txt variant="label" tone="faint">Свежие рекорды</Txt>
          </View>
          {records.map((record) => (
            <View key={record.id} style={[styles.prRow, { borderTopColor: palette.line }]}>
              <View style={styles.prText}>
                <Txt variant="body" weight="500" numberOfLines={1}>{record.exerciseName}</Txt>
                <Txt variant="caption" tone="muted">
                  {PR_KIND_LABELS[record.kind]}
                  {record.repTarget ? ` · ${record.repTarget} повт.` : ''}
                </Txt>
              </View>
              <Txt variant="body" weight="600" tabular tone="ok">
                {formatWeight(record.value, settings.unit)}
              </Txt>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cta: { marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  block: { marginBottom: spacing.md, gap: 4 },
  insights: { gap: spacing.sm, marginTop: spacing.sm },
  insightRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  insightText: { flex: 1 },
  link: { marginTop: spacing.md },
  cardHead: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  prText: { flex: 1, gap: 2 },
});
