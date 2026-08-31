import type { Equipment, MetricType, MuscleGroup, SetType } from '@/constants/enums';
import { getDatabase } from '@/db/client';
import type {
  PreviousPerformance,
  SessionStatus,
  SessionWithContents,
  WorkoutExercise,
  WorkoutExerciseWithSets,
  WorkoutSession,
  WorkoutSet,
} from '@/types/domain';
import { toLocalDate } from '@/utils/date';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapSession(row: Row): WorkoutSession {
  return {
    id: String(row.id),
    templateId: str(row.template_id),
    templateNameSnapshot: str(row.template_name_snapshot),
    title: String(row.title),
    status: row.status as SessionStatus,
    startedAt: Number(row.started_at),
    finishedAt: num(row.finished_at),
    durationSec: num(row.duration_sec),
    localDate: String(row.local_date),
    notes: str(row.notes),
    totalVolumeKg: num(row.total_volume_kg),
    totalSets: num(row.total_sets),
    totalReps: num(row.total_reps),
    totalExercises: num(row.total_exercises),
    prCount: num(row.pr_count),
    bodyWeightKg: num(row.body_weight_kg),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapExercise(row: Row): WorkoutExercise {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    exerciseId: str(row.exercise_id),
    exerciseName: String(row.exercise_name_snapshot),
    metricType: row.metric_type_snapshot as MetricType,
    equipment: (str(row.equipment_snapshot) as Equipment) ?? null,
    primaryMuscle: (str(row.primary_muscle_snapshot) as MuscleGroup) ?? null,
    position: Number(row.position),
    restSec: num(row.rest_sec),
    notes: str(row.notes),
  };
}

function mapSet(row: Row): WorkoutSet {
  return {
    id: String(row.id),
    workoutExerciseId: String(row.workout_exercise_id),
    setIndex: Number(row.set_index),
    setType: row.set_type as SetType,
    weightKg: num(row.weight_kg),
    reps: num(row.reps),
    durationSec: num(row.duration_sec),
    distanceM: num(row.distance_m),
    assistKg: num(row.assist_kg),
    addedWeightKg: num(row.added_weight_kg),
    rir: num(row.rir),
    rpe: num(row.rpe),
    isCompleted: row.is_completed === 1,
    completedAt: num(row.completed_at),
    volumeKg: num(row.volume_kg),
    est1rmKg: num(row.est_1rm_kg),
    isPr: row.is_pr === 1,
    notes: str(row.notes),
  };
}

export interface NewSessionInput {
  title: string;
  templateId?: string | null;
  templateName?: string | null;
  bodyWeightKg?: number | null;
  startedAt?: number;
}

export interface NewExerciseInput {
  exerciseId: string | null;
  exerciseName: string;
  metricType: MetricType;
  equipment?: Equipment | null;
  primaryMuscle?: MuscleGroup | null;
  restSec?: number | null;
}

export interface SetPatch {
  setType?: SetType;
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  assistKg?: number | null;
  addedWeightKg?: number | null;
  rir?: number | null;
  rpe?: number | null;
  isCompleted?: boolean;
  volumeKg?: number | null;
  est1rmKg?: number | null;
  isPr?: boolean;
  notes?: string | null;
}

export const WorkoutRepository = {
  async getActiveSession(): Promise<WorkoutSession | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>(
      "SELECT * FROM workout_session WHERE status = 'active' AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1",
    );
    return row ? mapSession(row) : null;
  },

  async createSession(input: NewSessionInput): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = input.startedAt ?? Date.now();
    await db.runAsync(
      `INSERT INTO workout_session (
         id, template_id, template_name_snapshot, title, status, started_at, local_date,
         body_weight_kg, created_at, updated_at
       ) VALUES (?,?,?,?,'active',?,?,?,?,?)`,
      [id, input.templateId ?? null, input.templateName ?? null, input.title, now,
        toLocalDate(now), input.bodyWeightKg ?? null, now, now],
    );
    return id;
  },

  async addExercise(sessionId: string, input: NewExerciseInput): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_exercise WHERE session_id = ?',
      [sessionId],
    );
    await db.runAsync(
      `INSERT INTO workout_exercise (
         id, session_id, exercise_id, exercise_name_snapshot, metric_type_snapshot,
         equipment_snapshot, primary_muscle_snapshot, position, rest_sec, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, sessionId, input.exerciseId, input.exerciseName, input.metricType,
        input.equipment ?? null, input.primaryMuscle ?? null, row?.next ?? 0,
        input.restSec ?? null, now, now],
    );
    await touchSession(sessionId);
    return id;
  },

  async removeExercise(workoutExerciseId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM workout_exercise WHERE id = ?', [workoutExerciseId]);
  },

  async replaceExercise(workoutExerciseId: string, input: NewExerciseInput): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM workout_set WHERE workout_exercise_id = ?', [workoutExerciseId]);
      await tx.runAsync(
        `UPDATE workout_exercise
         SET exercise_id = ?, exercise_name_snapshot = ?, metric_type_snapshot = ?,
             equipment_snapshot = ?, primary_muscle_snapshot = ?, rest_sec = ?, updated_at = ?
         WHERE id = ?`,
        [input.exerciseId, input.exerciseName, input.metricType, input.equipment ?? null,
          input.primaryMuscle ?? null, input.restSec ?? null, Date.now(), workoutExerciseId],
      );
    });
  },

  async reorderExercises(sessionId: string, orderedIds: string[]): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await tx.runAsync('UPDATE workout_exercise SET position = ? WHERE id = ? AND session_id = ?', [
          i, orderedIds[i], sessionId,
        ]);
      }
    });
  },

  async updateExerciseNotes(workoutExerciseId: string, notes: string | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE workout_exercise SET notes = ?, updated_at = ? WHERE id = ?', [
      notes, Date.now(), workoutExerciseId,
    ]);
  },

  async updateExerciseRest(workoutExerciseId: string, restSec: number | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE workout_exercise SET rest_sec = ?, updated_at = ? WHERE id = ?', [
      restSec, Date.now(), workoutExerciseId,
    ]);
  },

  async addSet(workoutExerciseId: string, seed: SetPatch = {}): Promise<WorkoutSet> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(set_index) + 1, 1) AS next FROM workout_set WHERE workout_exercise_id = ?',
      [workoutExerciseId],
    );
    const setIndex = row?.next ?? 1;
    await db.runAsync(
      `INSERT INTO workout_set (
         id, workout_exercise_id, set_index, set_type, weight_kg, reps, duration_sec, distance_m,
         assist_kg, added_weight_kg, rir, rpe, is_completed, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
      [id, workoutExerciseId, setIndex, seed.setType ?? 'working', seed.weightKg ?? null,
        seed.reps ?? null, seed.durationSec ?? null, seed.distanceM ?? null,
        seed.assistKg ?? null, seed.addedWeightKg ?? null, seed.rir ?? null, seed.rpe ?? null,
        now, now],
    );
    const created = await db.getFirstAsync<Row>('SELECT * FROM workout_set WHERE id = ?', [id]);
    return mapSet(created as Row);
  },

  /** Точечное обновление подхода. Пишем сразу — тренировка не должна жить только в памяти. */
  async updateSet(setId: string, patch: SetPatch): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    const push = (column: string, value: string | number | null) => {
      fields.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.setType !== undefined) push('set_type', patch.setType);
    if (patch.weightKg !== undefined) push('weight_kg', patch.weightKg);
    if (patch.reps !== undefined) push('reps', patch.reps);
    if (patch.durationSec !== undefined) push('duration_sec', patch.durationSec);
    if (patch.distanceM !== undefined) push('distance_m', patch.distanceM);
    if (patch.assistKg !== undefined) push('assist_kg', patch.assistKg);
    if (patch.addedWeightKg !== undefined) push('added_weight_kg', patch.addedWeightKg);
    if (patch.rir !== undefined) push('rir', patch.rir);
    if (patch.rpe !== undefined) push('rpe', patch.rpe);
    if (patch.volumeKg !== undefined) push('volume_kg', patch.volumeKg);
    if (patch.est1rmKg !== undefined) push('est_1rm_kg', patch.est1rmKg);
    if (patch.notes !== undefined) push('notes', patch.notes);
    if (patch.isPr !== undefined) push('is_pr', patch.isPr ? 1 : 0);
    if (patch.isCompleted !== undefined) {
      push('is_completed', patch.isCompleted ? 1 : 0);
      push('completed_at', patch.isCompleted ? Date.now() : null);
    }

    if (fields.length === 0) return;
    push('updated_at', Date.now());
    params.push(setId);

    await db.runAsync(`UPDATE workout_set SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async deleteSet(setId: string): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ workout_exercise_id: string }>(
      'SELECT workout_exercise_id FROM workout_set WHERE id = ?',
      [setId],
    );
    await db.runAsync('DELETE FROM workout_set WHERE id = ?', [setId]);
    if (row) await renumberSets(row.workout_exercise_id);
  },

  async getSessionWithContents(sessionId: string): Promise<SessionWithContents | null> {
    const db = await getDatabase();
    const sessionRow = await db.getFirstAsync<Row>('SELECT * FROM workout_session WHERE id = ?', [sessionId]);
    if (!sessionRow) return null;

    const exerciseRows = await db.getAllAsync<Row>(
      'SELECT * FROM workout_exercise WHERE session_id = ? ORDER BY position',
      [sessionId],
    );
    const setRows = await db.getAllAsync<Row>(
      `SELECT s.* FROM workout_set s
       JOIN workout_exercise we ON we.id = s.workout_exercise_id
       WHERE we.session_id = ?
       ORDER BY we.position, s.set_index`,
      [sessionId],
    );

    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const row of setRows) {
      const set = mapSet(row);
      const list = setsByExercise.get(set.workoutExerciseId) ?? [];
      list.push(set);
      setsByExercise.set(set.workoutExerciseId, list);
    }

    const exercises: WorkoutExerciseWithSets[] = exerciseRows.map((row) => {
      const exercise = mapExercise(row);
      return { ...exercise, sets: setsByExercise.get(exercise.id) ?? [] };
    });

    return { ...mapSession(sessionRow), exercises };
  },

  async listSessions(limit = 30, offset = 0): Promise<WorkoutSession[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM workout_session
       WHERE status = 'completed' AND deleted_at IS NULL
       ORDER BY started_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map(mapSession);
  },

  async getSession(sessionId: string): Promise<WorkoutSession | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>('SELECT * FROM workout_session WHERE id = ?', [sessionId]);
    return row ? mapSession(row) : null;
  },

  async updateSessionMeta(
    sessionId: string,
    patch: { title?: string; notes?: string | null },
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.title !== undefined) {
      fields.push('title = ?');
      params.push(patch.title);
    }
    if (patch.notes !== undefined) {
      fields.push('notes = ?');
      params.push(patch.notes);
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    params.push(Date.now(), sessionId);
    await db.runAsync(`UPDATE workout_session SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async finishSession(
    sessionId: string,
    totals: {
      finishedAt: number;
      durationSec: number;
      volumeKg: number;
      sets: number;
      reps: number;
      exercises: number;
      prCount: number;
    },
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE workout_session
       SET status = 'completed', finished_at = ?, duration_sec = ?, total_volume_kg = ?,
           total_sets = ?, total_reps = ?, total_exercises = ?, pr_count = ?, updated_at = ?
       WHERE id = ?`,
      [totals.finishedAt, totals.durationSec, totals.volumeKg, totals.sets, totals.reps,
        totals.exercises, totals.prCount, Date.now(), sessionId],
    );
  },

  /** Возврат завершённой тренировки в режим редактирования (явное действие пользователя). */
  async reopenSession(sessionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE workout_session SET status = 'active', updated_at = ? WHERE id = ?",
      [Date.now(), sessionId],
    );
  },

  async discardSession(sessionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM workout_session WHERE id = ?', [sessionId]);
  },

  async softDeleteSession(sessionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE workout_session SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      Date.now(), Date.now(), sessionId,
    ]);
  },

  /**
   * Прошлое выполнение упражнения — центральная функция всего приложения:
   * именно она показывает «в прошлый раз было 80 × 8».
   */
  async getPreviousPerformance(
    exerciseId: string,
    beforeMs: number,
    excludeSessionId?: string,
  ): Promise<PreviousPerformance | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ id: string; session_id: string; started_at: number }>(
      `SELECT we.id, we.session_id, s.started_at
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
       WHERE we.exercise_id = ?
         AND s.status = 'completed' AND s.deleted_at IS NULL
         AND s.started_at < ?
         AND (? IS NULL OR s.id != ?)
         AND EXISTS (SELECT 1 FROM workout_set ws WHERE ws.workout_exercise_id = we.id AND ws.is_completed = 1)
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [exerciseId, beforeMs, excludeSessionId ?? null, excludeSessionId ?? null],
    );
    if (!row) return null;

    const sets = await db.getAllAsync<Row>(
      `SELECT set_index, set_type, weight_kg, reps, duration_sec, rir, rpe
       FROM workout_set
       WHERE workout_exercise_id = ? AND is_completed = 1
       ORDER BY set_index`,
      [row.id],
    );

    return {
      sessionId: row.session_id,
      performedAt: Number(row.started_at),
      sets: sets.map((s) => ({
        setIndex: Number(s.set_index),
        setType: s.set_type as SetType,
        weightKg: num(s.weight_kg),
        reps: num(s.reps),
        durationSec: num(s.duration_sec),
        rir: num(s.rir),
        rpe: num(s.rpe),
      })),
    };
  },

  /** Несколько последних выполнений — для карточки упражнения и AI. */
  async getExerciseHistory(exerciseId: string, limit = 10): Promise<PreviousPerformance[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string; session_id: string; started_at: number }>(
      `SELECT we.id, we.session_id, s.started_at
       FROM workout_exercise we
       JOIN workout_session s ON s.id = we.session_id
       WHERE we.exercise_id = ? AND s.status = 'completed' AND s.deleted_at IS NULL
       ORDER BY s.started_at DESC LIMIT ?`,
      [exerciseId, limit],
    );
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const setRows = await db.getAllAsync<Row>(
      `SELECT * FROM workout_set
       WHERE workout_exercise_id IN (${ids.map(() => '?').join(',')}) AND is_completed = 1
       ORDER BY set_index`,
      ids,
    );

    return rows.map((row) => ({
      sessionId: row.session_id,
      performedAt: Number(row.started_at),
      sets: setRows
        .filter((s) => String(s.workout_exercise_id) === row.id)
        .map((s) => ({
          setIndex: Number(s.set_index),
          setType: s.set_type as SetType,
          weightKg: num(s.weight_kg),
          reps: num(s.reps),
          durationSec: num(s.duration_sec),
          rir: num(s.rir),
          rpe: num(s.rpe),
        })),
    }));
  },

  async getExercisesWithSets(sessionId: string): Promise<WorkoutExerciseWithSets[]> {
    const session = await this.getSessionWithContents(sessionId);
    return session?.exercises ?? [];
  },
};

async function touchSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE workout_session SET updated_at = ? WHERE id = ?', [Date.now(), sessionId]);
}

async function renumberSets(workoutExerciseId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM workout_set WHERE workout_exercise_id = ? ORDER BY set_index',
    [workoutExerciseId],
  );
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < rows.length; i += 1) {
      await tx.runAsync('UPDATE workout_set SET set_index = ? WHERE id = ?', [i + 1, rows[i].id]);
    }
  });
}
