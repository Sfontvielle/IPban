import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MuscleGlyph } from '@/components/ui/MuscleGlyph';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/constants/enums';
import { TemplateRepository, type TemplateWithExercises } from '@/repositories/TemplateRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService } from '@/services/WorkoutService';
import { spacing } from '@/theme/tokens';
import { plural } from '@/utils/date';

export function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateWithExercises | null>(null);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setTemplate(await TemplateRepository.getWithExercises(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!template) {
    return (
      <Screen>
        <Txt tone="muted">Загрузка…</Txt>
      </Screen>
    );
  }

  const start = async () => {
    const active = await WorkoutRepository.getActiveSession();
    if (active) {
      Alert.alert(
        'Тренировка уже идёт',
        'Сначала завершите или отмените текущую тренировку.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Открыть', onPress: () => router.push('/workout/active') },
        ],
      );
      return;
    }
    setStarting(true);
    try {
      await WorkoutService.startFromTemplate(template.id);
      router.push('/workout/active');
    } finally {
      setStarting(false);
    }
  };

  const duplicate = async () => {
    const newId = await TemplateRepository.duplicate(template.id, `${template.name} (копия)`);
    router.replace(`/template/${newId}`);
  };

  const remove = () => {
    Alert.alert('Удалить тренировку?', 'Проведённые тренировки в истории сохранятся.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await TemplateRepository.remove(template.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Txt variant="h2">{template.name}</Txt>
      <Txt variant="small" tone="muted" style={styles.subtitle}>
        {template.exercises.length}{' '}
        {plural(template.exercises.length, 'упражнение', 'упражнения', 'упражнений')}
      </Txt>
      {template.notes ? <Txt style={styles.notes}>{template.notes}</Txt> : null}

      <Button
        title="Начать тренировку"
        size="lg"
        fullWidth
        onPress={start}
        loading={starting}
        disabled={template.exercises.length === 0}
        style={styles.cta}
      />

      {template.exercises.map((exercise, index) => (
        <Card key={exercise.id} style={styles.row} padded={false}>
          <View style={styles.rowInner}>
            <Txt variant="small" tone="faint" tabular style={styles.index}>{index + 1}</Txt>
            <MuscleGlyph muscle={exercise.primaryMuscle} size={38} />
            <View style={styles.rowText}>
              <Txt variant="body" weight="500" numberOfLines={1}>{exercise.exerciseName}</Txt>
              <Txt variant="caption" tone="muted">
                {[
                  exercise.primaryMuscle ? MUSCLE_LABELS[exercise.primaryMuscle] : null,
                  exercise.equipment ? EQUIPMENT_LABELS[exercise.equipment] : null,
                  exercise.targetSets ? `${exercise.targetSets} подхода` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
            </View>
          </View>
        </Card>
      ))}

      <View style={styles.actions}>
        <Button
          title="Редактировать"
          variant="secondary"
          onPress={() => router.push(`/template/${template.id}/edit`)}
          style={styles.flex}
        />
        <Button title="Дублировать" variant="secondary" onPress={duplicate} />
      </View>
      <Button title="Удалить тренировку" variant="danger" fullWidth onPress={remove} style={styles.delete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 2 },
  notes: { marginTop: spacing.sm },
  cta: { marginVertical: spacing.lg },
  row: { marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  index: { width: 16 },
  rowText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  flex: { flex: 1 },
  delete: { marginTop: spacing.sm },
});
