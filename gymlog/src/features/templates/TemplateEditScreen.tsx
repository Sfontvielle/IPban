import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { TemplateRepository, type TemplateWithExercises } from '@/repositories/TemplateRepository';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function TemplateEditScreen() {
  const { id, isNew } = useLocalSearchParams<{ id: string; isNew?: string }>();
  const router = useRouter();
  const palette = usePalette();

  const [template, setTemplate] = useState<TemplateWithExercises | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    const loaded = await TemplateRepository.getWithExercises(id);
    setTemplate(loaded);
    if (loaded) {
      setName(loaded.name);
      setNotes(loaded.notes ?? '');
    }
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

  const save = async () => {
    await TemplateRepository.update(template.id, {
      name: name.trim() || 'Без названия',
      notes: notes.trim() || null,
    });
    if (isNew) router.replace(`/template/${template.id}`);
    else router.back();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= template.exercises.length) return;
    const next = [...template.exercises];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setTemplate({ ...template, exercises: next });
    await TemplateRepository.reorderExercises(template.id, next.map((item) => item.id));
  };

  const removeExercise = async (templateExerciseId: string) => {
    setTemplate({
      ...template,
      exercises: template.exercises.filter((item) => item.id !== templateExerciseId),
    });
    await TemplateRepository.removeExercise(templateExerciseId);
  };

  const changeSets = async (templateExerciseId: string, delta: number) => {
    const exercise = template.exercises.find((item) => item.id === templateExerciseId);
    if (!exercise) return;
    const value = Math.max(1, Math.min(12, (exercise.targetSets ?? 3) + delta));
    setTemplate({
      ...template,
      exercises: template.exercises.map((item) =>
        item.id === templateExerciseId ? { ...item, targetSets: value } : item,
      ),
    });
    await TemplateRepository.updateExercise(templateExerciseId, { targetSets: value });
  };

  return (
    <Screen scroll>
      <Txt variant="label" tone="faint" style={styles.label}>Название</Txt>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Например: Грудь + трицепс"
        placeholderTextColor={palette.inkFaint}
        style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.line, color: palette.ink }]}
      />

      <Txt variant="label" tone="faint" style={styles.label}>Заметка</Txt>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Например: разминка 10 минут, потом базовые движения"
        placeholderTextColor={palette.inkFaint}
        multiline
        style={[
          styles.input,
          styles.multiline,
          { backgroundColor: palette.surface, borderColor: palette.line, color: palette.ink },
        ]}
      />

      <View style={styles.headRow}>
        <Txt variant="label" tone="faint">Упражнения</Txt>
        <Pressable
          onPress={() => router.push(`/exercise/picker?target=template&templateId=${template.id}`)}
          hitSlop={10}
        >
          <Txt variant="small" tone="accent" weight="600">+ Добавить</Txt>
        </Pressable>
      </View>

      {template.exercises.length === 0 ? (
        <EmptyState
          icon="➕"
          title="Упражнений пока нет"
          description="Добавьте упражнения из каталога."
          actionTitle="Добавить упражнения"
          onAction={() => router.push(`/exercise/picker?target=template&templateId=${template.id}`)}
        />
      ) : (
        template.exercises.map((exercise, index) => (
          <Card key={exercise.id} style={styles.row}>
            <View style={styles.rowHead}>
              <Txt variant="body" weight="500" numberOfLines={1} style={styles.flex}>
                {exercise.exerciseName}
              </Txt>
              <Pressable onPress={() => removeExercise(exercise.id)} hitSlop={10}>
                <Txt tone="crit" variant="title">✕</Txt>
              </Pressable>
            </View>

            <View style={styles.controls}>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => changeSets(exercise.id, -1)}
                  style={[styles.stepButton, { backgroundColor: palette.surfaceAlt }]}
                >
                  <Txt variant="title">−</Txt>
                </Pressable>
                <Txt variant="body" tabular style={styles.stepValue}>
                  {exercise.targetSets ?? 3} подх.
                </Txt>
                <Pressable
                  onPress={() => changeSets(exercise.id, 1)}
                  style={[styles.stepButton, { backgroundColor: palette.surfaceAlt }]}
                >
                  <Txt variant="title">+</Txt>
                </Pressable>
              </View>

              <View style={styles.moveGroup}>
                <Pressable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  style={[styles.stepButton, { backgroundColor: palette.surfaceAlt, opacity: index === 0 ? 0.4 : 1 }]}
                >
                  <Txt>↑</Txt>
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  disabled={index === template.exercises.length - 1}
                  style={[
                    styles.stepButton,
                    {
                      backgroundColor: palette.surfaceAlt,
                      opacity: index === template.exercises.length - 1 ? 0.4 : 1,
                    },
                  ]}
                >
                  <Txt>↓</Txt>
                </Pressable>
              </View>
            </View>
          </Card>
        ))
      )}

      <Button title="Сохранить" fullWidth onPress={save} style={styles.save} />
      {!isNew ? (
        <Button
          title="Удалить тренировку"
          variant="danger"
          fullWidth
          style={styles.delete}
          onPress={() =>
            Alert.alert('Удалить тренировку?', 'История проведённых тренировок сохранится.', [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                  await TemplateRepository.remove(template.id);
                  router.replace('/workouts');
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: { marginBottom: spacing.sm, gap: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 70, textAlign: 'center' },
  moveGroup: { flexDirection: 'row', gap: spacing.sm },
  save: { marginTop: spacing.xl },
  delete: { marginTop: spacing.sm },
});
