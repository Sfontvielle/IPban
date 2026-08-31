import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useRestTimerStore } from '@/stores/restTimerStore';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { formatClock } from '@/utils/date';

/** Полоса таймера отдыха над панелью действий. Время считается от метки окончания. */
export function RestTimerBar() {
  const palette = usePalette();
  const { remaining, isRunning, isFinished, progress } = useRestTimer();
  const addTime = useRestTimerStore((s) => s.addTime);
  const skip = useRestTimerStore((s) => s.skip);
  const endsAt = useRestTimerStore((s) => s.endsAt);

  if (!endsAt) return null;

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: isFinished ? palette.okSoft : palette.surface,
          borderColor: isFinished ? palette.ok : palette.line,
        },
      ]}
    >
      <View style={[styles.progressTrack, { backgroundColor: palette.surfaceAlt }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, progress * 100)}%`, backgroundColor: palette.accent },
          ]}
        />
      </View>

      <View style={styles.row}>
        <View>
          <Txt variant="label" tone="faint">{isFinished ? 'Отдых закончен' : 'Отдых'}</Txt>
          <Txt variant="h2" tabular tone={isFinished ? 'ok' : 'default'}>
            {formatClock(remaining)}
          </Txt>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => addTime(30)}
            style={[styles.action, { backgroundColor: palette.surfaceAlt }]}
            hitSlop={6}
          >
            <Txt variant="small" weight="600">+30 с</Txt>
          </Pressable>
          <Pressable
            onPress={skip}
            style={[styles.action, { backgroundColor: palette.surfaceAlt }]}
            hitSlop={6}
          >
            <Txt variant="small" weight="600">{isRunning ? 'Пропустить' : 'Скрыть'}</Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  progressTrack: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.sm },
});
