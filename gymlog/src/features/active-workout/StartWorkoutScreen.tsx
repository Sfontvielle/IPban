import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { RecoveryRepository } from '@/repositories/RecoveryRepository';
import { TemplateRepository } from '@/repositories/TemplateRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService } from '@/services/WorkoutService';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { WorkoutTemplate } from '@/types/domain';
import { plural } from '@/utils/date';

const MOODS = [
  { value: 1, emoji: '😫', label: 'Плохое' },
  { value: 2, emoji: '😐', label: 'Нормально' },
  { value: 3, emoji: '🙂', label: 'Хорошее' },
  { value: 4, emoji: '🔥', label: 'Отличное' },
];

export function StartWorkoutScreen() {
  const router = useRouter();
  const palette = usePalette();
  const loadSession = useActiveWorkoutStore((s) => s.load);

  const [templates, setTemplates] = useState<(WorkoutTemplate & { count: number })[]>([]);
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      const active = await WorkoutRepository.getActiveSession();
      if (active) {
        router.replace('/workout/active');
        return;
      }
      const list = await TemplateRepository.list();
      const withCount = await Promise.all(
        list.map(async (template) => ({
          ...template,
          count: (await TemplateRepository.listExercises(template.id)).length,
        })),
      );
      setTemplates(withCount);
    })();
  }, [router]);

  const begin = async (templateId: string | null) => {
    setStarting(true);
    try {
      const sessionId = templateId
        ? await WorkoutService.startFromTemplate(templateId)
        : await WorkoutService.startEmpty();

      if (mood !== null || sleep !== null) {
        await RecoveryRepository.saveForSession(sessionId, { mood, sleep });
      }

      await loadSession(sessionId);
      router.replace('/workout/active');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen scroll>
      <Txt variant="h2">Начать тренировку</Txt>

      <Txt variant="label" tone="faint" style={styles.section}>Самочувствие · необязательно</Txt>
      <View style={styles.moods}>
        {MOODS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setMood(mood === item.value ? null : item.value)}
            style={[
              styles.mood,
              {
                backgroundColor: mood === item.value ? palette.accentSoft : palette.surface,
                borderColor: mood === item.value ? palette.accent : palette.line,
              },
            ]}
          >
            <Txt style={styles.moodEmoji}>{item.emoji}</Txt>
            <Txt variant="caption" tone="muted">{item.label}</Txt>
          </Pressable>
        ))}
      </View>

      <Txt variant="label" tone="faint" style={styles.section}>Сон · необязательно</Txt>
      <View style={styles.moods}>
        {[1, 2, 3, 4].map((value) => (
          <Pressable
            key={value}
            onPress={() => setSleep(sleep === value ? null : value)}
            style={[
              styles.mood,
              {
                backgroundColor: sleep === value ? palette.accentSoft : palette.surface,
                borderColor: sleep === value ? palette.accent : palette.line,
              },
            ]}
          >
            <Txt variant="title">{'★'.repeat(value)}</Txt>
          </Pressable>
        ))}
      </View>

      <Txt variant="label" tone="faint" style={styles.section}>Программа</Txt>
      {templates.map((template) => (
        <Card key={template.id} onPress={() => begin(template.id)} style={styles.template}>
          <Txt variant="title" numberOfLines={1}>{template.name}</Txt>
          <Txt variant="small" tone="muted">
            {template.count} {plural(template.count, 'упражнение', 'упражнения', 'упражнений')}
          </Txt>
        </Card>
      ))}

      <Button
        title="Пустая тренировка"
        variant="secondary"
        fullWidth
        loading={starting}
        onPress={() => begin(null)}
        style={styles.empty}
      />
      <Txt variant="caption" tone="faint" style={styles.hint}>
        Упражнения можно добавить прямо во время тренировки.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  moods: { flexDirection: 'row', gap: spacing.sm },
  mood: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  moodEmoji: { fontSize: 22 },
  template: { marginBottom: spacing.sm, gap: 2 },
  empty: { marginTop: spacing.md },
  hint: { marginTop: spacing.sm, textAlign: 'center' },
});
