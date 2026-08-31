import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { AIChatService } from '@/ai/AIChatService';
import { isAIConfigured } from '@/ai/AIService';
import { ChatRepository } from '@/repositories/ai/ChatRepository';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { AiChat } from '@/types/domain';
import { formatDayLabel } from '@/utils/date';

const SUGGESTIONS = [
  'Как у меня идёт жим лёжа?',
  'Какие упражнения стоят на месте?',
  'Сколько тренировок было за месяц?',
  'Какие мышцы я давно не тренировал?',
  'Какие PR были за последние 30 дней?',
  'Что попробовать на следующей тренировке ног?',
];

export function CoachScreen() {
  const router = useRouter();
  const palette = usePalette();
  const settings = useSettingsStore((s) => s.settings);
  const [chats, setChats] = useState<AiChat[]>([]);

  useFocusEffect(
    useCallback(() => {
      ChatRepository.listChats(20).then(setChats);
    }, []),
  );

  const startChat = async (question?: string) => {
    const chatId = await AIChatService.ensureChat('general', null);
    router.push(`/chat/${chatId}${question ? `?q=${encodeURIComponent(question)}` : ''}`);
  };

  return (
    <Screen scroll bottomInset={20}>
      <Txt variant="h1">AI Тренер</Txt>
      <Txt tone="muted" style={styles.subtitle}>
        Отвечает по вашей реальной истории тренировок. Все числа считает приложение.
      </Txt>

      {!isAIConfigured() ? (
        <Card style={styles.warning}>
          <Txt variant="label" tone="warn">AI не настроен</Txt>
          <Txt variant="small" tone="muted">
            {settings.aiEnabled
              ? 'Укажите адрес вашего AI-сервера в настройках. Ключ провайдера хранится только на сервере.'
              : 'Включите AI-тренера в настройках и укажите адрес сервера.'}
          </Txt>
          <Button
            title="Открыть настройки AI"
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        </Card>
      ) : null}

      <Button title="Новая беседа" fullWidth onPress={() => startChat()} style={styles.newChat} />

      <Txt variant="label" tone="faint" style={styles.sectionTitle}>Быстрые вопросы</Txt>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((question) => (
          <Pressable
            key={question}
            onPress={() => startChat(question)}
            style={[styles.suggestion, { backgroundColor: palette.surface, borderColor: palette.line }]}
          >
            <Txt variant="small">{question}</Txt>
          </Pressable>
        ))}
      </View>

      {chats.length > 0 ? (
        <>
          <Txt variant="label" tone="faint" style={styles.sectionTitle}>Беседы</Txt>
          {chats.map((chat) => (
            <Card
              key={chat.id}
              onPress={() => router.push(`/chat/${chat.id}`)}
              style={styles.chat}
            >
              <Txt variant="body" weight="500" numberOfLines={1}>
                {chat.title ?? 'Без названия'}
              </Txt>
              <Txt variant="caption" tone="muted">{formatDayLabel(chat.updatedAt)}</Txt>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 4, marginBottom: spacing.lg },
  warning: { gap: spacing.sm, marginBottom: spacing.lg },
  newChat: { marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  suggestions: { gap: spacing.sm },
  suggestion: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chat: { marginBottom: spacing.sm, gap: 2 },
});
