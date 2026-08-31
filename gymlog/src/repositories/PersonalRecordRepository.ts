import type { PrKind } from '@/constants/enums';
import { getDatabase } from '@/db/client';
import type { PreviousBests, DetectedRecord } from '@/analytics/personalRecords';
import type { PersonalRecord } from '@/types/domain';
import { toLocalDate } from '@/utils/date';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function mapRecord(row: Row): PersonalRecord {
  return {
    id: String(row.id),
    exerciseId: String(row.exercise_id),
    exerciseName: String(row.exercise_name ?? ''),
    kind: row.kind as PrKind,
    repTarget: row.rep_target === null ? null : Number(row.rep_target),
    value: Number(row.value),
    unit: String(row.unit),
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    sessionId: row.session_id ? String(row.session_id) : null,
    workoutSetId: row.workout_set_id ? String(row.workout_set_id) : null,
    achievedAt: Number(row.achieved_at),
    localDate: String(row.local_date),
  };
}

const SELECT_WITH_NAME = `
  SELECT pr.*, COALESCE(e.name_ru, '') AS exercise_name
  FROM personal_record pr
  LEFT JOIN exercise e ON e.id = pr.exercise_id
`;

export const PersonalRecordRepository = {
  /** Лучшие значения ДО указанной даты — вход для detectPersonalRecords. */
  async getPreviousBests(exerciseId: string, beforeMs: number): Promise<PreviousBests> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ kind: string; rep_target: number | null; best: number }>(
      `SELECT kind, rep_target, MAX(value) AS best
       FROM personal_record
       WHERE exercise_id = ? AND achieved_at < ?
       GROUP BY kind, rep_target`,
      [exerciseId, beforeMs],
    );

    const result: PreviousBests = { repMaxKg: {} };
    for (const row of rows) {
      switch (row.kind) {
        case 'max_weight':
          result.maxWeightKg = row.best;
          break;
        case 'est_1rm':
          result.est1rmKg = row.best;
          break;
        case 'set_volume':
          result.setVolumeKg = row.best;
          break;
        case 'session_volume':
          result.sessionVolumeKg = row.best;
          break;
        case 'rep_max':
          if (row.rep_target !== null) result.repMaxKg![row.rep_target] = row.best;
          break;
        default:
          break;
      }
    }
    return result;
  },

  async insertMany(records: DetectedRecord[], sessionId: string, achievedAt: number): Promise<void> {
    if (records.length === 0) return;
    const db = await getDatabase();
    const localDate = toLocalDate(achievedAt);
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const record of records) {
        await tx.runAsync(
          `INSERT INTO personal_record (
             id, exercise_id, kind, rep_target, value, unit, previous_value,
             session_id, workout_set_id, achieved_at, local_date
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [newId(), record.exerciseId, record.kind, record.repTarget, record.value, record.unit,
            record.previousValue, sessionId, record.workoutSetId, achievedAt, localDate],
        );
        if (record.workoutSetId) {
          await tx.runAsync('UPDATE workout_set SET is_pr = 1 WHERE id = ?', [record.workoutSetId]);
        }
      }
    });
  },

  async deleteBySession(sessionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM personal_record WHERE session_id = ?', [sessionId]);
  },

  async listRecent(limit = 10): Promise<PersonalRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `${SELECT_WITH_NAME} ORDER BY pr.achieved_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(mapRecord);
  },

  async listSince(fromMs: number, limit = 50): Promise<PersonalRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `${SELECT_WITH_NAME} WHERE pr.achieved_at >= ? ORDER BY pr.achieved_at DESC LIMIT ?`,
      [fromMs, limit],
    );
    return rows.map(mapRecord);
  },

  async listByExercise(exerciseId: string, limit = 50): Promise<PersonalRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `${SELECT_WITH_NAME} WHERE pr.exercise_id = ? ORDER BY pr.achieved_at DESC LIMIT ?`,
      [exerciseId, limit],
    );
    return rows.map(mapRecord);
  },

  async listBySession(sessionId: string): Promise<PersonalRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `${SELECT_WITH_NAME} WHERE pr.session_id = ? ORDER BY pr.value DESC`,
      [sessionId],
    );
    return rows.map(mapRecord);
  },

  async countSince(fromMs: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM personal_record WHERE achieved_at >= ?',
      [fromMs],
    );
    return row?.n ?? 0;
  },
};
