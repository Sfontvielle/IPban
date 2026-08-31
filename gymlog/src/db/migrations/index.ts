import type { Database } from '@/db/client';
import * as m001 from '@/db/migrations/001_initial';
import * as m002 from '@/db/migrations/002_fts';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
}

/**
 * Порядок и номера менять нельзя. Новые изменения схемы — только новым элементом в конце.
 */
export const migrations: Migration[] = [
  { version: 1, name: 'initial', up: m001.up },
  { version: 2, name: 'fts', up: m002.up },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;

export async function getSchemaVersion(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(db: Database): Promise<{ from: number; to: number }> {
  const from = await getSchemaVersion(db);
  const pending = migrations.filter((migration) => migration.version > from);

  for (const migration of pending) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await migration.up(tx);
    });
    // PRAGMA user_version нельзя выполнять внутри транзакции на всех сборках — ставим после.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  return { from, to: await getSchemaVersion(db) };
}
