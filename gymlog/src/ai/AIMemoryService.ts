import { MemoryRepository } from '@/repositories/ai/MemoryRepository';

/**
 * Память AI полностью контролируется пользователем: ничего не сохраняется автоматически.
 * Экран «Настройки → AI → Память» показывает всё, что модель увидит.
 */
export const AIMemoryService = {
  list: MemoryRepository.list,
  add: (text: string, category?: string | null) => MemoryRepository.add(text, category ?? null, 'user'),
  update: MemoryRepository.update,
  remove: MemoryRepository.remove,
  clear: MemoryRepository.clear,
};
