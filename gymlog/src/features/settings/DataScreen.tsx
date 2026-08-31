import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { ChatRepository } from '@/repositories/ai/ChatRepository';
import { AnalysisRepository } from '@/repositories/ai/AnalysisRepository';
import { BackupService } from '@/services/BackupService';
import { spacing } from '@/theme/tokens';

export function DataScreen() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, successText?: string) => {
    setBusy(key);
    try {
      await action();
      if (successText) Alert.alert('Готово', successText);
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось выполнить операцию');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll>
      <Txt variant="h2">Данные</Txt>
      <Txt tone="muted" style={styles.subtitle}>
        Вся история хранится только на этом iPhone. Резервная копия — обычный JSON-файл,
        который вы можете сохранить куда угодно.
      </Txt>

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">Экспорт</Txt>
        <Button
          title="Резервная копия (JSON)"
          variant="secondary"
          fullWidth
          loading={busy === 'json'}
          onPress={() => run('json', () => BackupService.exportToFile())}
        />
        <Button
          title="История подходов (CSV)"
          variant="secondary"
          fullWidth
          loading={busy === 'csv'}
          onPress={() => run('csv', () => BackupService.exportSetsCsv())}
        />
      </Card>

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">Импорт</Txt>
        <Txt variant="small" tone="muted">
          Загрузка копии полностью заменит текущие тренировки, шаблоны и рекорды.
        </Txt>
        <Button
          title="Загрузить резервную копию"
          variant="secondary"
          fullWidth
          loading={busy === 'import'}
          onPress={() =>
            Alert.alert('Заменить все данные?', 'Текущая история будет удалена безвозвратно.', [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Продолжить',
                style: 'destructive',
                onPress: () =>
                  run('import', async () => {
                    const result = await BackupService.importFromFile();
                    Alert.alert(result.ok ? 'Готово' : 'Не выполнено', result.message);
                  }),
              },
            ])
          }
        />
      </Card>

      <Card style={styles.block}>
        <Txt variant="label" tone="faint">Очистка</Txt>
        <Button
          title="Очистить историю AI-чатов"
          variant="secondary"
          fullWidth
          loading={busy === 'ai'}
          onPress={() =>
            run(
              'ai',
              async () => {
                await ChatRepository.deleteAll();
                await AnalysisRepository.clear();
              },
              'История AI удалена',
            )
          }
        />
        <Button
          title="Удалить все мои данные"
          variant="danger"
          fullWidth
          loading={busy === 'wipe'}
          onPress={() =>
            Alert.alert(
              'Удалить все тренировки?',
              'Тренировки, шаблоны, рекорды, вес тела и свои упражнения будут стёрты. ' +
                'Каталог упражнений останется.',
              [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Удалить всё',
                  style: 'destructive',
                  onPress: () => run('wipe', () => BackupService.wipeUserData(), 'Данные удалены'),
                },
              ],
            )
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: spacing.lg },
  block: { marginBottom: spacing.md, gap: spacing.sm },
});
