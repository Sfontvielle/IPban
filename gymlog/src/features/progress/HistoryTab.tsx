import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Txt } from '@/components/ui/Txt';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { spacing } from '@/theme/tokens';
import type { WorkoutSession } from '@/types/domain';
import { formatDayLabel, formatDuration, formatMonthTitle, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';

const PAGE = 20;

export function HistoryTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [canLoadMore, setCanLoadMore] = useState(true);

  const load = useCallback(async (offset: number) => {
    const items = await WorkoutRepository.listSessions(PAGE, offset);
    setCanLoadMore(items.length === PAGE);
    setSessions((current) => (offset === 0 ? items : [...current, ...items]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(0);
    }, [load]),
  );

  let lastMonth = '';

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (canLoadMore) load(sessions.length);
      }}
      renderItem={({ item }) => {
        const month = formatMonthTitle(item.startedAt);
        const showMonth = month !== lastMonth;
        lastMonth = month;
        return (
          <View>
            {showMonth ? (
              <Txt variant="label" tone="faint" style={styles.month}>{month}</Txt>
            ) : null}
            <Card onPress={() => router.push(`/history/${item.id}`)} style={styles.card}>
              <View style={styles.head}>
                <Txt variant="body" weight="600" numberOfLines={1} style={styles.flex}>{item.title}</Txt>
                {item.prCount ? <Txt variant="small">🏆 {item.prCount}</Txt> : null}
              </View>
              <Txt variant="small" tone="muted">
                {formatDayLabel(item.startedAt)} · {formatDuration(item.durationSec ?? 0)} ·{' '}
                {item.totalExercises ?? 0}{' '}
                {plural(item.totalExercises ?? 0, 'упражнение', 'упражнения', 'упражнений')} ·{' '}
                {formatInt(item.totalVolumeKg ?? 0)} кг
              </Txt>
            </Card>
          </View>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon="📒"
          title="История пуста"
          description="Здесь появятся все проведённые тренировки."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  month: { marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
