import { AIError } from '@/ai/provider/AIProvider';
import { buildWorkoutAnalysisContext } from '@/ai/context/WorkoutAnalysisContext';
import { ANALYSIS_SYSTEM } from '@/ai/prompts/system';
import { isAIConfigured, runConversation } from '@/ai/AIService';
import { AnalysisRepository } from '@/repositories/ai/AnalysisRepository';

export type AnalysisResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export const AIAnalysisService = {
  async getCached(sessionId: string): Promise<string | null> {
    const stored = await AnalysisRepository.getBySession(sessionId);
    return stored?.content ?? null;
  },

  /**
   * Разбор тренировки. Контекст — уже посчитанные приложением числа,
   * сам разбор кешируется, чтобы повторное открытие итогов не стоило денег.
   */
  async analyze(sessionId: string): Promise<AnalysisResult> {
    if (!isAIConfigured()) {
      return {
        ok: false,
        error: 'AI не настроен. Включите его и укажите адрес сервера в «Настройки → AI-тренер».',
      };
    }

    try {
      const context = await buildWorkoutAnalysisContext(sessionId);
      const result = await runConversation({
        system: ANALYSIS_SYSTEM,
        maxTokens: 900,
        messages: [
          {
            role: 'user',
            content:
              `Вот данные тренировки в формате JSON. Все числа уже посчитаны приложением.\n\n${context}\n\n` +
              'Дай короткий разбор этой тренировки.',
          },
        ],
      });

      await AnalysisRepository.save(sessionId, result.text, context, result.model);
      return { ok: true, text: result.text };
    } catch (error) {
      if (error instanceof AIError) {
        if (error.kind === 'offline') {
          return { ok: false, error: 'Нет соединения. Разбор можно получить позже — тренировка уже сохранена.' };
        }
        return { ok: false, error: error.message };
      }
      return { ok: false, error: 'Не удалось получить разбор тренировки.' };
    }
  },
};
