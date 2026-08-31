import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Txt } from '@/components/ui/Txt';
import { ExerciseBlock } from '@/features/active-workout/components/ExerciseBlock';
import { RestTimerBar } from '@/features/active-workout/components/RestTimerBar';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService } from '@/services/WorkoutService';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { useRestTimerStore } from '@/stores/restTimerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatDuration, plural } from '@/utils/date';
import { formatInt } from '@/utils/format';

export function ActiveWorkoutScreen() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((s) => s.settings);

  const store = useActiveWorkoutStore();
  const startRest = useRestTimerStore((s) => s.start);

  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // Восстановление активной тренировки после перезапуска приложения.
  useEffect(() => {
    (async () => {
      if (store.sessionId) return;
      const active = await WorkoutRepository.getActiveSession();
      if (active) await store.load(active.id);
      else router.replace('/workout/start');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!store.session) return;
    const update = () => setElapsed(Math.round((Date.now() - store.session!.startedAt) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [store.session]);

  // Действия достаём из стора по одному: их ссылки стабильны,
  // поэтому карточки упражнений не перерисовываются лишний раз.
  const toggleSetCompleted = useActiveWorkoutStore((s) => s.toggleSetCompleted);
  const patchSet = useActiveWorkoutStore((s) => s.patchSet);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);

  const handleToggleSet = useCallback(
    async (setId: string, restSec: number | null) => {
      const completed = await toggleSetCompleted(setId);
      if (completed && settings.autoRestTimer) {
        startRest(restSec ?? settings.defaultRestSec);
      }
    },
    [settings.autoRestTimer, settings.defaultRestSec, startRest, toggleSetCompleted],
  );

  const finish = () => {
    const completedSets = store.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.isCompleted).length,
      0,
    );
    if (completedSets === 0) {
      Alert.alert('Нет выполненных подходов', 'Отметьте хотя бы один подход или отмените тренировку.');
      return;
    }
    Alert.alert('Завершить тренировку?', `Выполнено подходов: ${completedSets}`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Завершить',
        onPress: async () => {
          if (!store.sessionId) return;
          setFinishing(true);
          try {
            await WorkoutService.finishSession(store.sessionId);
            const sessionId = store.sessionId;
            useRestTimerStore.getState().skip();
            store.clear();
            router.replace(`/workout/summary/${sessionId}`);
          } finally {
            setFinishing(false);
          }
        },
      },
    ]);
  };

  const cancel = () => {
    Alert.alert('Отменить тренировку?', 'Все записанные подходы будут удалены безвозвратно.', [
      { text: 'Продолжить тренировку', style: 'cancel' },
      {
        text: 'Отменить тренировку',
        style: 'destructive',
        onPress: async () => {
          if (store.sessionId) await WorkoutService.discard(store.sessionId);
          useRestTimerStore.getState().skip();
          store.clear();
          router.replace('/');
        },
      },
    ]);
  };

  const completedSets = store.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const volume = store.exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets.reduce((inner, set) => inner + (set.isCompleted ? set.volumeKg ?? 0 : 0), 0),
    0,
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.ground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { borderBottomColor: palette.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Txt variant="small" tone="accent" weight="600">Свернуть</Txt>
        </Pressable>
        <View style={styles.headerCenter}>
          <Txt variant="body" weight="600" numberOfLines={1}>{store.session?.title ?? 'Тренировка'}</Txt>
          <Txt variant="caption" tone="muted" tabular>
            {formatDuration(elapsed)} · {completedSets}{' '}
            {plural(completedSets, 'подход', 'подхода', 'подходов')} · {formatInt(volume)} кг
          </Txt>
        </View>
        <Pressable onPress={cancel} hitSlop={10}>
          <Txt variant="small" tone="crit" weight="600">Отменить</Txt>
        </Pressable>
      </View>

      <FlatList
        data={store.exercises}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <ExerciseBlock
            exercise={item}
            previous={item.exerciseId ? store.previous[item.exerciseId] ?? null : null}
            unit={settings.unit}
            intensityMode={settings.intensityMode}
            onAddSet={addSet}
            onPatchSet={patchSet}
            onToggleSet={handleToggleSet}
            onDeleteSet={removeSet}
            onRemove={removeExercise}
            onMove={moveExercise}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🏋️"
            title="Добавьте упражнения"
            description="Тренировка начата. Выберите упражнения из каталога."
            actionTitle="Добавить упражнения"
            onAction={() => router.push('/exercise/picker')}
          />
        }
        ListFooterComponent={
          store.exercises.length > 0 ? (
            <Button
              title="+ Добавить упражнение"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/exercise/picker')}
              style={styles.addExercise}
            />
          ) : null
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <RestTimerBar />
        <View style={styles.footerActions}>
          <Button
            title="Таймер"
            variant="secondary"
            onPress={() => startRest(settings.defaultRestSec)}
          />
          <Button
            title="Завершить тренировку"
            onPress={finish}
            loading={finishing}
            style={styles.finish}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  addExercise: { marginTop: spacing.sm },
  footer: { paddingTop: spacing.sm },
  footerActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  finish: { flex: 1 },
});
