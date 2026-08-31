import { COUNTED_SET_TYPES } from '@/constants/enums';
import { getDatabase } from '@/db/client';
import type { ExerciseSessionPoint } from '@/analytics/progression';

const COUNTED = COUNTED_SET_TYPES.map((type) => `'${type}'`).join(',');
const COUNTED_FILTER = `ws.is_completed = 1 AND ws.set_type IN (${COUNTED})`;

export interface PeriodSummary {
  sessions: number;
  volumeKg: number;
  sets: number;
  reps: number;
  durationSec: number;
}

export interface MuscleVolumeRow {
  muscle: string;
  volumeKg: number;
  sets: number;
}

export interface ExerciseSummary {
  sessionCount: number;
  totalSets: number;
  totalVolumeKg: number;
  bestWeightKg: number | null;
  bestEst1rmKg: number | null;
  bestSetVolumeKg: number | null;
  lastPerformedAt: number | null;
}

export const StatsRepository = {
  async periodSummary(fromMs: number, toMs: number): Promise<PeriodSummary> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      sessions: number; volume: number | null; sets: number | null;
      reps: number | null; duration: number | null;
    }>(
      `SELECT COUNT(DISTINCT s.id) AS sessions,
              COALESCE(SUM(s.total_volume_kg), 0) AS volume,
              COALESCE(SUM(s.total_sets), 0) AS sets,
              COALESCE(SUM(s.total_reps), 0) AS reps,
              COALESCE(SUM(s.duration_sec), 0) AS duration
       FROM workout_session s
       WHERE s.status = 'completed' AND s.deleted_at IS NULL
         AND s.started_at BETWEEN ? AND ?`,
      [fromMs, toMs],
    );
    return {
      sessions: row?.sessions ?? 0,
      volumeKg: row?.volume ?? 0,
      sets: row?.sets ?? 0,
      reps: row?.reps ?? 0,
      durationSec: row?.duration ?? 0,
    };
  },

  async sessionTimestamps(fromMs: number, toMs: number): Promise<{ at: number; volumeKg: number }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ started_at: number; total_volume_kg: number | null }>(
      `SELECT started_at, total_volume_kg FROM workout_session
       WHERE status = 'completed' AND deleted_at IS NULL AND started_at BETWEEN ? AND ?
       ORDER BY started_at`,
      [fromMs, toMs],
    );
    return rows.map((row) => ({ at: Number(row.started_at), volumeKg: Number(row.total_volume_kg ?? 0) }));
  },

  /** Точки для графиков прогресса — агрегация делается в SQL, а не в JS. */
  async exerciseSessionPoints(exerciseId: string, limit = 100): Promise<ExerciseSessionPoint[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      session_id: string; started_at: number; local_date: string;
      max_weight: number | null; best_1rm: number | null; best_set_volume: number | null;
      total_volume: number | null; total_sets: number | null; total_reps: number | null;
      max_reps: number | null;
    }>(
      `SELECT s.id AS session_id, s.started_at, s.local_date,
              MAX(ws.weight_kg)  AS max_weight,
              MAX(ws.est_1rm_kg) AS best_1rm,
              MAX(ws.volume_kg)  AS best_set_volume,
              SUM(ws.volume_kg)  AS total_volume,
              COUNT(ws.id)       AS total_sets,
              SUM(ws.reps)       AS total_reps,
              MAX(ws.reps)       AS max_reps
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
            AND s.status = 'completed' AND s.deleted_at IS NULL
       JOIN workout_set ws ON ws.workout_exercise_id = we.id AND ${COUNTED_FILTER}
       WHERE we.exercise_id = ?
       GROUP BY s.id
       ORDER BY s.started_at DESC
       LIMIT ?`,
      [exerciseId, limit],
    );

    return rows
      .map((row) => ({
        sessionId: row.session_id,
        performedAt: Number(row.started_at),
        localDate: row.local_date,
        maxWeightKg: Number(row.max_weight ?? 0),
        bestEst1rmKg: Number(row.best_1rm ?? 0),
        bestSetVolumeKg: Number(row.best_set_volume ?? 0),
        totalVolumeKg: Number(row.total_volume ?? 0),
        totalSets: Number(row.total_sets ?? 0),
        totalReps: Number(row.total_reps ?? 0),
        maxReps: Number(row.max_reps ?? 0),
      }))
      .reverse();
  },

  async exerciseSummary(exerciseId: string): Promise<ExerciseSummary> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      sessions: number; sets: number; volume: number | null;
      best_weight: number | null; best_1rm: number | null; best_set_volume: number | null;
      last_at: number | null;
    }>(
      `SELECT COUNT(DISTINCT s.id) AS sessions,
              COUNT(ws.id)         AS sets,
              SUM(ws.volume_kg)    AS volume,
              MAX(ws.weight_kg)    AS best_weight,
              MAX(ws.est_1rm_kg)   AS best_1rm,
              MAX(ws.volume_kg)    AS best_set_volume,
              MAX(s.started_at)    AS last_at
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
            AND s.status = 'completed' AND s.deleted_at IS NULL
       JOIN workout_set ws ON ws.workout_exercise_id = we.id AND ${COUNTED_FILTER}
       WHERE we.exercise_id = ?`,
      [exerciseId],
    );
    return {
      sessionCount: row?.sessions ?? 0,
      totalSets: row?.sets ?? 0,
      totalVolumeKg: row?.volume ?? 0,
      bestWeightKg: row?.best_weight ?? null,
      bestEst1rmKg: row?.best_1rm ?? null,
      bestSetVolumeKg: row?.best_set_volume ?? null,
      lastPerformedAt: row?.last_at ?? null,
    };
  },

  async muscleVolume(fromMs: number, toMs: number): Promise<MuscleVolumeRow[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ muscle: string | null; volume: number | null; sets: number }>(
      `SELECT we.primary_muscle_snapshot AS muscle,
              SUM(ws.volume_kg) AS volume,
              COUNT(ws.id)      AS sets
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
            AND s.status = 'completed' AND s.deleted_at IS NULL
       JOIN workout_set ws ON ws.workout_exercise_id = we.id AND ${COUNTED_FILTER}
       WHERE s.started_at BETWEEN ? AND ?
       GROUP BY we.primary_muscle_snapshot
       ORDER BY sets DESC`,
      [fromMs, toMs],
    );
    return rows
      .filter((row) => row.muscle)
      .map((row) => ({
        muscle: String(row.muscle),
        volumeKg: Number(row.volume ?? 0),
        sets: Number(row.sets),
      }));
  },

  /** Когда в последний раз нагружалась каждая группа мышц. */
  async lastTrainedByMuscle(): Promise<Record<string, number>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ muscle: string | null; last_at: number }>(
      `SELECT we.primary_muscle_snapshot AS muscle, MAX(s.started_at) AS last_at
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
            AND s.status = 'completed' AND s.deleted_at IS NULL
       GROUP BY we.primary_muscle_snapshot`,
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.muscle) result[row.muscle] = Number(row.last_at);
    }
    return result;
  },

  /** Упражнения, которые пользователь делал достаточно часто — кандидаты на анализ застоя. */
  async frequentExercises(minSessions = 3, limit = 20): Promise<{ exerciseId: string; name: string; sessions: number }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ exercise_id: string; name: string; sessions: number }>(
      `SELECT we.exercise_id, MAX(we.exercise_name_snapshot) AS name, COUNT(DISTINCT s.id) AS sessions
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
            AND s.status = 'completed' AND s.deleted_at IS NULL
       WHERE we.exercise_id IS NOT NULL
       GROUP BY we.exercise_id
       HAVING sessions >= ?
       ORDER BY sessions DESC
       LIMIT ?`,
      [minSessions, limit],
    );
    return rows.map((row) => ({
      exerciseId: row.exercise_id,
      name: row.name,
      sessions: Number(row.sessions),
    }));
  },

  async totalSessions(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM workout_session WHERE status = 'completed' AND deleted_at IS NULL",
    );
    return row?.n ?? 0;
  },
};
