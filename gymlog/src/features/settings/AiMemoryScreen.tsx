import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { AIMemoryService } from '@/ai/AIMemoryService';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { AiMemoryItem } from '@/types/domain';

const EXAMPLES = [
  'Тренируюсь 4 раза в неделю',
  'Не люблю выпады',
  'Дома есть только гантели',
  'Берегу правое плечо',
];

export function AiMemoryScreen() {
  const palette = usePalette();
  const [items, setItems] = useState<AiMemoryItem[]>([]);
  const [text, setText] = useState('');

  const reload = useCallback(async () => {
    setItems(await AIMemoryService.list());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const add = async (value: string) => {
    if (!value.trim()) return;
    await AIMemoryService.add(value.trim());
    setText('');
    await reload();
  };

  const remove = (item: AiMemoryItem) => {
    Alert.alert('Удалить факт?', item.text, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await AIMemoryService.remove(item.id);
          await reload();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Txt variant="h2">Память AI</Txt>
      <Txt tone="muted" style={styles.subtitle}>
        Здесь всё, что модель знает о вас помимо истории тренировок.
        Приложение ничего не запоминает автоматически — вы добавляете факты сами.
      </Txt>

      <Card style={styles.addBlock}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Например: тренируюсь 4 раза в неделю"
          placeholderTextColor={palette.inkFaint}
          style={[styles.input, { backgroundColor: palette.surfaceAlt, color: palette.ink }]}
        />
        <Button title="Добавить" onPress={() => add(text)} disabled={!text.trim()} />
      </Card>

      {items.length === 0 ? (
        <>
          <EmptyState icon="🧠" title="Память пуста" description="Добавьте факты, которые важны для рекомендаций." />
          <Txt variant="label" tone="faint" style={styles.section}>Примеры</Txt>
          {EXAMPLES.map((example) => (
            <ListRow key={example} title={example} value="+" onPress={() => add(example)} />
          ))}
        </>
      ) : (
        <Card padded={false} style={styles.list}>
          {items.map((item, index) => (
            <ListRow
              key={item.id}
              title={item.text}
              subtitle={item.isEnabled ? undefined : 'выключено'}
              last={index === items.length - 1}
              onPress={() => remove(item)}
              right={
                <Switch
                  value={item.isEnabled}
                  onValueChange={async (value) => {
                    await AIMemoryService.update(item.id, { isEnabled: value });
                    await reload();
                  }}
                />
              }
            />
          ))}
        </Card>
      )}

      {items.length > 0 ? (
        <Button
          title="Очистить память"
          variant="danger"
          fullWidth
          style={styles.clear}
          onPress={() =>
            Alert.alert('Очистить всю память AI?', undefined, [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Очистить',
                style: 'destructive',
                onPress: async () => {
                  await AIMemoryService.clear();
                  await reload();
                },
              },
            ])
          }
        />
      ) : null}

      <View style={styles.footer}>
        <Txt variant="caption" tone="faint">
          Нажмите на факт, чтобы удалить его. Выключенный факт не передаётся модели.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: spacing.lg },
  addBlock: { gap: spacing.sm, marginBottom: spacing.lg },
  input: { height: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  list: { marginBottom: spacing.md },
  clear: { marginTop: spacing.md },
  footer: { marginTop: spacing.lg },
});
