import type { Database } from '@/db/client';

/**
 * Полнотекстовый поиск. Вынесен в отдельную миграцию,
 * потому что это единственная часть схемы, которая может быть недоступна:
 * если FTS5 в сборке нет, приложение переключается на поиск по search_blob.
 */
export const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS exercise_fts USING fts5(
  exercise_id UNINDEXED,
  name_ru,
  name_en,
  aliases,
  muscles,
  equipment,
  tags,
  tokenize = "unicode61 remove_diacritics 2",
  prefix = '2 3 4'
);
`;

export async function up(db: Database): Promise<void> {
  try {
    await db.execAsync(FTS_SQL);
  } catch (error) {
    // FTS5 недоступен — не повод ломать установку. Поиск уйдёт на LIKE-fallback.
    console.warn('[gymlog] FTS5 недоступен, используется резервный поиск', error);
  }
}
