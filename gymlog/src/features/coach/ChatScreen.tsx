import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui/Txt';
import { AIChatService } from '@/ai/AIChatService';
import { ChatRepository } from '@/repositories/ai/ChatRepository';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { AiMessage } from '@/types/domain';

const TOOL_LABELS: Record<string, string> = {
  find_exercises: 'ищу упражнение',
  get_training_summary: 'смотрю сводку',
  get_recent_sessions: 'читаю последние тренировки',
  get_session_details: 'открываю тренировку',
  compare_sessions: 'сравниваю тренировки',
  get_exercise_history: 'читаю историю упражнения',
  get_exercise_progress: 'считаю прогресс',
  get_personal_records: 'смотрю рекорды',
  get_volume_by_muscle: 'считаю объём по мышцам',
  get_weekly_volume: 'считаю объём по неделям',
  get_stalled_exercises: 'ищу застой',
  get_untrained_muscles: 'смотрю нагрузку по мышцам',
  get_body_weight_trend: 'смотрю вес тела',
  get_exercise_reference: 'читаю справку',
  suggest_substitutes: 'подбираю замену',
  get_user_memory: 'читаю сохранённые факты',
};

export function ChatScreen() {
  const { chatId, q } = useLocalSearchParams<{ chatId: string; q?: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AiMessage>>(null);

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const autoSent = useRef(false);

  const reload = useCallback(async () => {
    if (!chatId) return;
    setMessages(await ChatRepository.listMessages(chatId));
  }, [chatId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const send = useCallback(
    async (value: string) => {
      if (!chatId || !value.trim() || sending) return;
      setSending(true);
      setText('');
      setStatus('думаю…');

      // Сообщение показываем сразу; в базу его пишет AIChatService.
      const optimistic: AiMessage = {
        id: `local-${Date.now()}`,
        chatId,
        role: 'user',
        content: value.trim(),
        toolName: null,
        toolPayloadJson: null,
        status: 'done',
        createdAt: Date.now(),
      };
      setMessages((current) => [...current, optimistic]);

      await AIChatService.send(chatId, value.trim(), (tool) =>
        setStatus(TOOL_LABELS[tool] ?? 'читаю данные…'),
      );

      setStatus(null);
      setSending(false);
      await reload();
    },
    [chatId, reload, sending],
  );

  useEffect(() => {
    if (q && !autoSent.current && chatId) {
      autoSent.current = true;
      send(String(q));
    }
  }, [q, chatId, send]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.ground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages.filter((message) => message.role !== 'tool')}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  backgroundColor: isUser
                    ? palette.accent
                    : item.status === 'error'
                      ? palette.critSoft
                      : palette.surface,
                  borderColor: isUser ? 'transparent' : palette.line,
                },
              ]}
            >
              <Txt
                variant="body"
                tone={isUser ? 'inverse' : item.status === 'error' ? 'crit' : 'default'}
                style={styles.bubbleText}
              >
                {item.content}
              </Txt>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt tone="muted" align="center">
              Спросите что-нибудь о своих тренировках. Я смотрю только на реальные данные из вашей базы.
            </Txt>
          </View>
        }
      />

      {status ? (
        <View style={styles.status}>
          <Txt variant="caption" tone="muted">AI {status}</Txt>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          { backgroundColor: palette.surface, borderTopColor: palette.line, paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ваш вопрос"
          placeholderTextColor={palette.inkFaint}
          multiline
          style={[styles.input, { backgroundColor: palette.surfaceAlt, color: palette.ink }]}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={!text.trim() || sending}
          style={[
            styles.send,
            { backgroundColor: palette.accent, opacity: !text.trim() || sending ? 0.4 : 1 },
          ]}
        >
          <Txt tone="inverse" weight="700">↑</Txt>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  bubbleText: { lineHeight: 21 },
  empty: { padding: spacing.xl },
  status: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
