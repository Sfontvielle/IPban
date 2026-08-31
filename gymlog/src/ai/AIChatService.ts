import { isAIConfigured, runConversation } from '@/ai/AIService';
import { CHAT_SYSTEM, EXERCISE_SYSTEM } from '@/ai/prompts/system';
import { AIError, type AIMessageInput } from '@/ai/provider/AIProvider';
import { TOOL_DEFINITIONS } from '@/ai/tools/definitions';
import { executeTool } from '@/ai/tools/handlers';
import { ChatRepository } from '@/repositories/ai/ChatRepository';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { MemoryRepository } from '@/repositories/ai/MemoryRepository';
import type { AiChat } from '@/types/domain';
import { truncate } from '@/utils/format';

export interface SendResult {
  ok: boolean;
  error?: string;
  toolNames: string[];
}

async function buildSystemPrompt(chat: AiChat): Promise<string> {
  const memory = await MemoryRepository.listEnabled();
  const memoryBlock = memory.length
    ? `\n\nЧто пользователь сохранил о себе:\n${memory.map((item) => `- ${item.text}`).join('\n')}`
    : '';

  if (chat.scope === 'exercise' && chat.refId) {
    const exercise = await ExerciseRepository.getById(chat.refId);
    return (
      `${EXERCISE_SYSTEM}\n\nТекущее упражнение: ${exercise?.nameRu ?? 'неизвестно'} ` +
      `(exerciseId: ${chat.refId}). Используй инструменты, чтобы получить его историю и справку.${memoryBlock}`
    );
  }

  return `${CHAT_SYSTEM}${memoryBlock}`;
}

export const AIChatService = {
  async ensureChat(scope: AiChat['scope'], refId: string | null): Promise<string> {
    return ChatRepository.createChat(scope, refId, null);
  },

  /**
   * Отправка сообщения. Инструменты выполняются локально —
   * на сервер уходит только текст переписки и результаты конкретных запросов.
   */
  async send(chatId: string, text: string, onToolCall?: (name: string) => void): Promise<SendResult> {
    const chat = await ChatRepository.getChat(chatId);
    if (!chat) return { ok: false, error: 'Беседа не найдена', toolNames: [] };

    await ChatRepository.addMessage({ chatId, role: 'user', content: text });
    if (!chat.title) await ChatRepository.setTitle(chatId, truncate(text, 40));

    if (!isAIConfigured()) {
      const error = 'AI не настроен. Включите его и укажите адрес сервера в «Настройки → AI-тренер».';
      await ChatRepository.addMessage({ chatId, role: 'assistant', content: error, status: 'error' });
      return { ok: false, error, toolNames: [] };
    }

    const stored = await ChatRepository.listMessages(chatId);
    const history: AIMessageInput[] = stored
      .filter((message) => message.role !== 'tool' && message.content && message.status !== 'error')
      .slice(-16)
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content as string,
      }));

    try {
      const system = await buildSystemPrompt(chat);
      const result = await runConversation({
        system,
        messages: history,
        tools: TOOL_DEFINITIONS,
        executeTool,
        onToolCall,
        maxTokens: 1200,
      });

      await ChatRepository.addMessage({
        chatId,
        role: 'assistant',
        content: result.text || 'Не удалось сформировать ответ.',
        toolPayloadJson: JSON.stringify(result.toolCalls.map((call) => call.name)),
      });

      return { ok: true, toolNames: result.toolCalls.map((call) => call.name) };
    } catch (error) {
      const message =
        error instanceof AIError
          ? error.kind === 'offline'
            ? 'Нет соединения с AI-сервером. История тренировок доступна и без сети.'
            : error.message
          : 'Не удалось получить ответ.';
      await ChatRepository.addMessage({ chatId, role: 'assistant', content: message, status: 'error' });
      return { ok: false, error: message, toolNames: [] };
    }
  },
};
