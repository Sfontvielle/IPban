import { getDatabase } from '@/db/client';

const KEY = 'app_settings';

export const SettingsRepository = {
  async load<T>(): Promise<Partial<T>> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      [KEY],
    );
    if (!row) return {};
    try {
      return JSON.parse(row.value_json) as Partial<T>;
    } catch {
      return {};
    }
  },

  async save<T>(settings: T): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?,?,?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [KEY, JSON.stringify(settings), Date.now()],
    );
  },
};
