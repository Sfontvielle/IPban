import type { Database } from '@/db/client';

/**
 * Полнотекстовый поиск.
 *
 * Выполняется ВНЕ транзакции: если FTS5 в сборке SQLite отсутствует,
 * CREATE VIRTUAL TABLE не просто вернёт ошибку, а сломает открытую транзакцию,
 * и приложение упадёт уже на коммите. Config-плагин expo-sqlite (enableFTS)
 * на Expo Go не действует — там используется готовый бинарник,
 * поэтому наличие FTS5 нужно именно проверять, а не предполагать.
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

/** Проверка, что таблица не только создалась, но и реально отвечает на запросы. */
async function verify(db: Database): Promise<boolean> {
  try {
    await db.runAsync(
      `INSERT INTO exercise_fts (exercise_id, name_ru, name_en, aliases, muscles, equipment, tags)
       VALUES ('__probe__', 'проверка', 'probe', '', '', '', '')`,
    );
    const row = await db.getFirstAsync<{ exercise_id: string }>(
      "SELECT exercise_id FROM exercise_fts WHERE exercise_fts MATCH '\"провер\"*' LIMIT 1",
    );
    await db.runAsync("DELETE FROM exercise_fts WHERE exercise_id = '__probe__'");
    return !!row;
  } catch (error) {
    console.warn('[gymlog] FTS5 создан, но не работает', error);
    return false;
  }
}

export async function up(db: Database): Promise<void> {
  try {
    await db.execAsync(FTS_SQL);
  } catch (error) {
    console.warn('[gymlog] FTS5 недоступен, будет использован резервный поиск', error);
    return;
  }

  if (!(await verify(db))) {
    // Нерабочую таблицу убираем, чтобы поиск честно ушёл на LIKE-фолбэк.
    try {
      await db.execAsync('DROP TABLE IF EXISTS exercise_fts');
    } catch {
      // Ничего не поделать — поиск всё равно переключится на резервный режим.
    }
  }
}
