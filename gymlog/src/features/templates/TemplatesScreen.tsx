import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { TemplateRepository } from '@/repositories/TemplateRepository';
import { spacing } from '@/theme/tokens';
import type { TemplateFolder, WorkoutTemplate } from '@/types/domain';
import { formatDayLabel, plural } from '@/utils/date';

interface Row extends WorkoutTemplate {
  exerciseCount: number;
}

export function TemplatesScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Row[]>([]);
  const [folders, setFolders] = useState<TemplateFolder[]>([]);

  const reload = useCallback(async () => {
    const [list, folderList] = await Promise.all([
      TemplateRepository.list(),
      TemplateRepository.listFolders(),
    ]);
    const withCounts = await Promise.all(
      list.map(async (template) => ({
        ...template,
        exerciseCount: (await TemplateRepository.listExercises(template.id)).length,
      })),
    );
    setTemplates(withCounts);
    setFolders(folderList);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const createTemplate = () => router.push('/template/new');

  const createFolder = () => {
    Alert.prompt?.(
      'Новая папка',
      'Название папки программ',
      async (value) => {
        if (value && value.trim()) {
          await TemplateRepository.createFolder(value.trim());
          reload();
        }
      },
      'plain-text',
    );
  };

  const grouped = [
    { id: null as string | null, name: 'Без папки', items: templates.filter((t) => !t.folderId) },
    ...folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      items: templates.filter((t) => t.folderId === folder.id),
    })),
  ].filter((group) => group.items.length > 0);

  return (
    <Screen scroll bottomInset={40}>
      <View style={styles.header}>
        <Txt variant="h1">Тренировки</Txt>
      </View>

      <View style={styles.actions}>
        <Button title="Новая тренировка" onPress={createTemplate} style={styles.flex} />
        <Button title="Быстрый старт" variant="secondary" onPress={() => router.push('/workout/start')} />
      </View>

      {templates.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Программ пока нет"
          description="Создайте шаблон — например «Грудь + трицепс» — и добавьте в него упражнения."
          actionTitle="Создать первую тренировку"
          onAction={createTemplate}
        />
      ) : (
        grouped.map((group) => (
          <View key={group.id ?? 'root'} style={styles.group}>
            {grouped.length > 1 ? (
              <Txt variant="label" tone="faint" style={styles.groupTitle}>{group.name}</Txt>
            ) : null}
            {group.items.map((template) => (
              <Card
                key={template.id}
                onPress={() => router.push(`/template/${template.id}`)}
                style={styles.card}
              >
                <View style={styles.cardHead}>
                  <Txt variant="title" numberOfLines={1} style={styles.flex}>{template.name}</Txt>
                  {template.isFavorite ? <Txt>★</Txt> : null}
                </View>
                <Txt variant="small" tone="muted">
                  {template.exerciseCount}{' '}
                  {plural(template.exerciseCount, 'упражнение', 'упражнения', 'упражнений')}
                  {template.lastUsedAt ? ` · ${formatDayLabel(template.lastUsedAt).toLowerCase()}` : ''}
                </Txt>
              </Card>
            ))}
          </View>
        ))
      )}

      {templates.length > 0 ? (
        <Button
          title="Создать папку"
          variant="ghost"
          fullWidth
          onPress={createFolder}
          style={styles.folderButton}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  flex: { flex: 1 },
  group: { marginBottom: spacing.md },
  groupTitle: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm, gap: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  folderButton: { marginTop: spacing.md },
});
