import Constants from 'expo-constants';

import {
  AIError,
  type AIMessageInput,
  type AIProvider,
  type AIResponse,
  type AIToolDefinition,
  type ContentBlock,
  type ToolUseBlock,
} from '@/ai/provider/AIProvider';
import { ProxyProvider } from '@/ai/provider/ProxyProvider';
import { currentSettings } from '@/stores/settingsStore';

/** Больше пяти вызовов инструментов на один вопрос — почти всегда зацикливание. */
export const MAX_TOOL_ROUNDS = 5;

export function resolveProxyUrl(): string {
  const fromSettings = currentSettings().aiProxyUrl?.trim();
  if (fromSettings) return fromSettings;
  const extra = Constants.expoConfig?.extra as { aiProxyUrl?: string } | undefined;
  return extra?.aiProxyUrl?.trim() ?? '';
}

export function getProvider(): AIProvider {
  return new ProxyProvider(resolveProxyUrl());
}

export function isAIConfigured(): boolean {
  return currentSettings().aiEnabled && resolveProxyUrl().length > 0;
}

export function extractText(content: ContentBlock[]): string {
  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export function extractToolUses(content: ContentBlock[]): ToolUseBlock[] {
  return content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
}

export interface ConversationResult {
  text: string;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  model: string | null;
}

/**
 * Цикл «модель просит данные — приложение их достаёт локально — модель отвечает».
 * Инструменты выполняются НА ТЕЛЕФОНЕ: на сервер уходит только результат конкретного запроса.
 */
export async function runConversation(options: {
  system: string;
  messages: AIMessageInput[];
  tools?: AIToolDefinition[];
  executeTool?: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  onToolCall?: (name: string) => void;
  maxTokens?: number;
}): Promise<ConversationResult> {
  const provider = getProvider();
  const messages: AIMessageInput[] = [...options.messages];
  const toolCalls: ConversationResult['toolCalls'] = [];
  let response: AIResponse | null = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    response = await provider.complete({
      system: options.system,
      messages,
      tools: options.tools,
      maxTokens: options.maxTokens,
    });

    const toolUses = extractToolUses(response.content);
    if (toolUses.length === 0 || !options.executeTool || round === MAX_TOOL_ROUNDS) break;

    messages.push({ role: 'assistant', content: response.content });

    const results: ContentBlock[] = [];
    for (const toolUse of toolUses) {
      options.onToolCall?.(toolUse.name);
      toolCalls.push({ name: toolUse.name, input: toolUse.input });
      try {
        const data = await options.executeTool(toolUse.name, toolUse.input);
        let serialized = JSON.stringify(data);
        if (serialized.length > 6000) {
          serialized = `${serialized.slice(0, 6000)}","truncated":true}`;
        }
        results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: serialized });
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: error instanceof Error ? error.message : 'ошибка' }),
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: results });
  }

  if (!response) throw new AIError('Пустой ответ провайдера', 'unknown');

  return { text: extractText(response.content), toolCalls, model: response.model };
}
