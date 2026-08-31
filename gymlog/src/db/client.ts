import * as SQLite from 'expo-sqlite';

export type Database = SQLite.SQLiteDatabase;

export const DATABASE_NAME = 'gymlog.db';

let instance: Database | null = null;
let opening: Promise<Database> | null = null;

/**
 * Единственное соединение с базой на всё приложение.
 * WAL — быстрее и устойчивее при внезапном закрытии приложения,
 * foreign_keys — чтобы битых ссылок не появлялось в принципе.
 */
export async function getDatabase(): Promise<Database> {
  if (instance) return instance;
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
      instance = db;
      return db;
    })();
  }
  return opening;
}

/** Только для тестов и полного сброса данных. */
export async function closeDatabase(): Promise<void> {
  if (instance) {
    await instance.closeAsync();
    instance = null;
    opening = null;
  }
}

export async function resetDatabaseFile(): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}
