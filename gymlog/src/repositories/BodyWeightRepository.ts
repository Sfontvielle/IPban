import { getDatabase } from '@/db/client';
import type { BodyWeightEntry } from '@/types/domain';
import { toLocalDate } from '@/utils/date';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function mapEntry(row: Row): BodyWeightEntry {
  return {
    id: String(row.id),
    measuredAt: Number(row.measured_at),
    localDate: String(row.local_date),
    weightKg: Number(row.weight_kg),
    note: row.note === null ? null : String(row.note),
  };
}

export const BodyWeightRepository = {
  async list(limit = 200): Promise<BodyWeightEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM body_weight_entry WHERE deleted_at IS NULL ORDER BY measured_at DESC LIMIT ?',
      [limit],
    );
    return rows.map(mapEntry);
  },

  async latest(): Promise<BodyWeightEntry | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>(
      'SELECT * FROM body_weight_entry WHERE deleted_at IS NULL ORDER BY measured_at DESC LIMIT 1',
    );
    return row ? mapEntry(row) : null;
  },

  /**
   * Вес тела на дату тренировки — ближайшая запись не позже этой даты.
   * Нужен, чтобы объём упражнений со своим весом не «переписывался» задним числом.
   */
  async weightAt(atMs: number): Promise<number | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ weight_kg: number }>(
      `SELECT weight_kg FROM body_weight_entry
       WHERE deleted_at IS NULL AND measured_at <= ?
       ORDER BY measured_at DESC LIMIT 1`,
      [atMs],
    );
    if (row) return Number(row.weight_kg);
    const fallback = await this.latest();
    return fallback?.weightKg ?? null;
  },

  /** Одна запись в день: повторное сохранение обновляет существующую. */
  async upsert(weightKg: number, measuredAt = Date.now(), note: string | null = null): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO body_weight_entry (id, measured_at, local_date, weight_kg, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(local_date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         measured_at = excluded.measured_at,
         note = excluded.note,
         deleted_at = NULL,
         updated_at = excluded.updated_at`,
      [newId(), measuredAt, toLocalDate(measuredAt), weightKg, note, now, now],
    );
  },

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE body_weight_entry SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      Date.now(), Date.now(), id,
    ]);
  },
};
