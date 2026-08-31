import * as SecureStore from 'expo-secure-store';

import {
  AIError,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type ContentBlock,
} from '@/ai/provider/AIProvider';
import { newId } from '@/utils/id';

const TOKEN_KEY = 'gymlog_device_token';

/**
 * Провайдер, который ходит в НАШ прокси, а не напрямую в API модели.
 * Ключ провайдера живёт только на сервере — в приложении его нет и быть не может.
 */
export class ProxyProvider implements AIProvider {
  readonly id = 'proxy';
  readonly capabilities = { tools: true, streaming: false };

  constructor(private readonly baseUrl: string) {}

  private async deviceToken(): Promise<string> {
    try {
      const existing = await SecureStore.getItemAsync(TOKEN_KEY);
      if (existing) return existing;
      const token = newId();
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      return token;
    } catch {
      // Без secure store работать можно, просто токен будет разовым.
      return newId();
    }
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    if (!this.baseUrl) {
      throw new AIError('Не задан адрес AI-сервера', 'not_configured');
    }

    const token = await this.deviceToken();
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/messages`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-token': token,
        },
        body: JSON.stringify({
          system: request.system,
          messages: request.messages,
          tools: request.tools,
          max_tokens: request.maxTokens ?? 1200,
        }),
      });
    } catch {
      throw new AIError('Нет соединения с AI-сервером', 'offline');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AIError(`AI-сервер вернул ошибку ${response.status}. ${text.slice(0, 200)}`, 'server');
    }

    const data = (await response.json()) as {
      content?: ContentBlock[];
      stop_reason?: string;
      model?: string;
      error?: { message?: string };
    };

    if (data.error) {
      throw new AIError(data.error.message ?? 'Ошибка AI-провайдера', 'server');
    }

    return {
      content: data.content ?? [],
      stopReason: data.stop_reason ?? null,
      model: data.model ?? null,
    };
  }
}
