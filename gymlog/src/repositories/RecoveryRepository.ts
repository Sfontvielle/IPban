import { getDatabase } from '@/db/client';
import type { RecoveryCheckin } from '@/types/domain';
import { toLocalDate } from '@/utils/date';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function mapCheckin(row: Row): RecoveryCheckin {
  const int = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    localDate: String(row.local_date),
    mood: int(row.mood),
    sleep: int(row.sleep),
    energy: int(row.energy),
    motivation: int(row.motivation),
    note: row.note === null ? null : String(row.note),
    createdAt: Number(row.created_at),
  };
}

export const RecoveryRepository = {
  async saveForSession(
    sessionId: string,
    values: { mood?: number | null; sleep?: number | null; energy?: number | null; motivation?: number | null; note?: string | null },
  ): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync('DELETE FROM recovery_checkin WHERE session_id = ?', [sessionId]);
    await db.runAsync(
      `INSERT INTO recovery_checkin (id, session_id, local_date, mood, sleep, energy, motivation, note, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [newId(), sessionId, toLocalDate(now), values.mood ?? null, values.sleep ?? null,
        values.energy ?? null, values.motivation ?? null, values.note ?? null, now],
    );
  },

  async getForSession(sessionId: string): Promise<RecoveryCheckin | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>('SELECT * FROM recovery_checkin WHERE session_id = ?', [sessionId]);
    return row ? mapCheckin(row) : null;
  },

  async listSince(fromMs: number): Promise<RecoveryCheckin[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM recovery_checkin WHERE created_at >= ? ORDER BY created_at DESC',
      [fromMs],
    );
    return rows.map(mapCheckin);
  },
};
