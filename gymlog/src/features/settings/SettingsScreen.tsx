import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import type { IntensityMode, ThemeMode, WeightUnit } from '@/constants/enums';
import { useDatabaseStatus } from '@/db/provider';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const REST_PRESETS = [30, 60, 90, 120, 180];
const WEIGHT_STEPS = [1, 1.25, 2.5, 5];

export function SettingsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { settings, update } = useSettingsStore();
  const dbStatus = useDatabaseStatus();
  const [proxyUrl, setProxyUrl] = useState(settings.aiProxyUrl);

  return (
    <Screen scroll>
      <Txt variant="h2">Настройки</Txt>

      <Txt variant="label" tone="faint" style={styles.section}>Внешний вид</Txt>
      <Card padded={false}>
        <View style={styles.chipRow}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode === 'system' ? 'Как в системе' : mode === 'light' ? 'Светлая' : 'Тёмная'}
              selected={settings.theme === mode}
              onPress={() => update({ theme: mode })}
            />
          ))}
        </View>
      </Card>

      <Txt variant="label" tone="faint" style={styles.section}>Единицы и шаг веса</Txt>
      <Card padded={false}>
        <View style={styles.chipRow}>
          {(['kg', 'lb'] as WeightUnit[]).map((unit) => (
            <Chip
              key={unit}
              label={unit === 'kg' ? 'Килограммы' : 'Фунты'}
              selected={settings.unit === unit}
              onPress={() => update({ unit })}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          {WEIGHT_STEPS.map((step) => (
            <Chip
              key={step}
              label={`Шаг ${String(step).replace('.', ',')}`}
              selected={settings.weightStep === step}
              onPress={() => update({ weightStep: step })}
            />
          ))}
        </View>
        <Txt variant="caption" tone="faint" style={styles.note}>
          В базе вес всегда хранится в килограммах — смена единиц не меняет вашу историю.
        </Txt>
      </Card>

      <Txt variant="label" tone="faint" style={styles.section}>Тренировка</Txt>
      <Card padded={false}>
        <View style={styles.chipRow}>
          {(['off', 'rir', 'rpe'] as IntensityMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode === 'off' ? 'Без RIR/RPE' : mode.toUpperCase()}
              selected={settings.intensityMode === mode}
              onPress={() => update({ intensityMode: mode })}
            />
          ))}
        </View>
        <ListRow
          title="Автоматический таймер отдыха"
          subtitle="Запускается после отметки подхода"
          right={
            <Switch
              value={settings.autoRestTimer}
              onValueChange={(value) => update({ autoRestTimer: value })}
            />
          }
        />
        <View style={styles.chipRow}>
          {REST_PRESETS.map((seconds) => (
            <Chip
              key={seconds}
              label={seconds < 60 ? `${seconds} с` : `${seconds / 60} мин`}
              selected={settings.defaultRestSec === seconds}
              onPress={() => update({ defaultRestSec: seconds })}
            />
          ))}
        </View>
        <ListRow
          title="Вибрация"
          right={
            <Switch value={settings.restHaptics} onValueChange={(value) => update({ restHaptics: value })} />
          }
        />
        <ListRow
          title="Уведомление об окончании отдыха"
          subtitle="Локальное уведомление, работает и при свёрнутом приложении"
          last
          right={
            <Switch
              value={settings.restNotification}
              onValueChange={(value) => update({ restNotification: value })}
            />
          }
        />
      </Card>

      <Txt variant="label" tone="faint" style={styles.section}>AI-тренер</Txt>
      <Card padded={false}>
        <ListRow
          title="Включить AI"
          subtitle="Трекер полностью работает и без него"
          right={<Switch value={settings.aiEnabled} onValueChange={(value) => update({ aiEnabled: value })} />}
        />
        <ListRow
          title="Автоматический разбор тренировки"
          right={
            <Switch
              value={settings.aiAutoAnalysis}
              onValueChange={(value) => update({ aiAutoAnalysis: value })}
            />
          }
        />
        <ListRow
          title="Подсказки во время тренировки"
          right={
            <Switch
              value={settings.aiWorkoutHints}
              onValueChange={(value) => update({ aiWorkoutHints: value })}
            />
          }
        />
        <View style={styles.inputBlock}>
          <Txt variant="caption" tone="muted">Адрес вашего AI-сервера</Txt>
          <TextInput
            value={proxyUrl}
            onChangeText={setProxyUrl}
            onBlur={() => update({ aiProxyUrl: proxyUrl.trim() })}
            placeholder="https://gymlog-ai.ваш-домен.workers.dev"
            placeholderTextColor={palette.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { backgroundColor: palette.surfaceAlt, color: palette.ink }]}
          />
          <Txt variant="caption" tone="faint">
            Ключ AI-провайдера хранится только на сервере. В приложении его нет и быть не должно.
          </Txt>
        </View>
        <ListRow
          title="Память AI"
          subtitle="Факты, которые видит модель"
          onPress={() => router.push('/settings/ai-memory')}
          last
        />
      </Card>

      <Txt variant="label" tone="faint" style={styles.section}>Данные</Txt>
      <Card padded={false}>
        <ListRow
          title="Экспорт, импорт и очистка"
          subtitle="Резервная копия всей базы в JSON"
          onPress={() => router.push('/settings/data')}
          last
        />
      </Card>

      <Txt variant="label" tone="faint" style={styles.section}>О приложении</Txt>
      <Card>
        <Txt variant="small" tone="muted">GymLog · версия 1.0.0</Txt>
        <Txt variant="small" tone="muted">
          Упражнений в каталоге: {dbStatus.exerciseCount} · Поиск FTS5:{' '}
          {dbStatus.ftsEnabled ? 'включён' : 'резервный режим'}
        </Txt>
        {dbStatus.catalogWarning ? (
          <Txt variant="small" tone="warn">
            Каталог не загрузился: {dbStatus.catalogWarning}
          </Txt>
        ) : null}
        <Txt variant="caption" tone="faint" style={styles.note}>
          Тексты техники подготовлены для GymLog. Изображения не используются — вместо них
          собственные векторные иконки, поэтому вопросов с лицензиями не возникает.
        </Txt>
      </Card>

      <Button
        title="Готово"
        variant="secondary"
        fullWidth
        onPress={() => router.back()}
        style={styles.done}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  note: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  inputBlock: { padding: spacing.md, gap: spacing.sm },
  input: {
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  done: { marginTop: spacing.xl },
});
