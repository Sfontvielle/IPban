import type { Equipment, MetricType, MuscleGroup } from '@/constants/enums';
import { getDatabase } from '@/db/client';
import type { TemplateExercise, TemplateFolder, WorkoutTemplate } from '@/types/domain';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapTemplate(row: Row): WorkoutTemplate {
  return {
    id: String(row.id),
    folderId: row.folder_id ? String(row.folder_id) : null,
    name: String(row.name),
    notes: row.notes === null ? null : String(row.notes),
    isFavorite: row.is_favorite === 1,
    position: Number(row.position),
    defaultRestSec: num(row.default_rest_sec),
    lastUsedAt: num(row.last_used_at),
    useCount: Number(row.use_count ?? 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapTemplateExercise(row: Row): TemplateExercise {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    exerciseId: String(row.exercise_id),
    position: Number(row.position),
    targetSets: num(row.target_sets),
    targetRepsMin: num(row.target_reps_min),
    targetRepsMax: num(row.target_reps_max),
    restSec: num(row.rest_sec),
    notes: row.notes === null ? null : String(row.notes),
    exerciseName: String(row.exercise_name),
    metricType: row.metric_type as MetricType,
    primaryMuscle: (row.primary_muscle as MuscleGroup) ?? null,
    equipment: (row.equipment as Equipment) ?? null,
  };
}

export interface TemplateWithExercises extends WorkoutTemplate {
  exercises: TemplateExercise[];
}

export const TemplateRepository = {
  async listFolders(): Promise<TemplateFolder[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM template_folder WHERE deleted_at IS NULL ORDER BY position, name',
    );
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      position: Number(row.position),
    }));
  },

  async createFolder(name: string): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM template_folder',
    );
    await db.runAsync(
      'INSERT INTO template_folder (id, name, position, created_at, updated_at) VALUES (?,?,?,?,?)',
      [id, name, row?.next ?? 0, now, now],
    );
    return id;
  },

  async renameFolder(id: string, name: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE template_folder SET name = ?, updated_at = ? WHERE id = ?', [
      name, Date.now(), id,
    ]);
  },

  async deleteFolder(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE template_folder SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      Date.now(), Date.now(), id,
    ]);
  },

  async list(): Promise<WorkoutTemplate[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM workout_template WHERE deleted_at IS NULL
       ORDER BY is_favorite DESC, position, name COLLATE NOCASE`,
    );
    return rows.map(mapTemplate);
  },

  async listRecent(limit = 3): Promise<WorkoutTemplate[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM workout_template
       WHERE deleted_at IS NULL AND last_used_at IS NOT NULL
       ORDER BY last_used_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(mapTemplate);
  },

  async getWithExercises(templateId: string): Promise<TemplateWithExercises | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>('SELECT * FROM workout_template WHERE id = ?', [templateId]);
    if (!row) return null;
    const exercises = await this.listExercises(templateId);
    return { ...mapTemplate(row), exercises };
  },

  async listExercises(templateId: string): Promise<TemplateExercise[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      `SELECT te.*, e.name_ru AS exercise_name, e.metric_type,
        (SELECT m.muscle FROM exercise_muscle m
          WHERE m.exercise_id = e.id AND m.role = 'primary' ORDER BY m.position LIMIT 1) AS primary_muscle,
        (SELECT q.equipment FROM exercise_equipment q
          WHERE q.exercise_id = e.id ORDER BY q.is_primary DESC LIMIT 1) AS equipment
       FROM template_exercise te
       JOIN exercise e ON e.id = te.exercise_id
       WHERE te.template_id = ?
       ORDER BY te.position`,
      [templateId],
    );
    return rows.map(mapTemplateExercise);
  },

  async create(input: { name: string; folderId?: string | null; notes?: string | null }): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM workout_template',
    );
    await db.runAsync(
      `INSERT INTO workout_template (id, folder_id, name, notes, position, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [id, input.folderId ?? null, input.name, input.notes ?? null, row?.next ?? 0, now, now],
    );
    return id;
  },

  async update(
    templateId: string,
    patch: { name?: string; notes?: string | null; folderId?: string | null; isFavorite?: boolean; defaultRestSec?: number | null },
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      params.push(patch.name);
    }
    if (patch.notes !== undefined) {
      fields.push('notes = ?');
      params.push(patch.notes);
    }
    if (patch.folderId !== undefined) {
      fields.push('folder_id = ?');
      params.push(patch.folderId);
    }
    if (patch.isFavorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(patch.isFavorite ? 1 : 0);
    }
    if (patch.defaultRestSec !== undefined) {
      fields.push('default_rest_sec = ?');
      params.push(patch.defaultRestSec);
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    params.push(Date.now(), templateId);
    await db.runAsync(`UPDATE workout_template SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(templateId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE workout_template SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      Date.now(), Date.now(), templateId,
    ]);
  },

  async duplicate(templateId: string, newName: string): Promise<string> {
    const source = await this.getWithExercises(templateId);
    if (!source) throw new Error('Шаблон не найден');
    const id = await this.create({ name: newName, folderId: source.folderId, notes: source.notes });
    for (const exercise of source.exercises) {
      await this.addExercise(id, exercise.exerciseId, {
        targetSets: exercise.targetSets,
        targetRepsMin: exercise.targetRepsMin,
        targetRepsMax: exercise.targetRepsMax,
        restSec: exercise.restSec,
        notes: exercise.notes,
      });
    }
    return id;
  },

  async addExercise(
    templateId: string,
    exerciseId: string,
    options: {
      targetSets?: number | null;
      targetRepsMin?: number | null;
      targetRepsMax?: number | null;
      restSec?: number | null;
      notes?: string | null;
    } = {},
  ): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM template_exercise WHERE template_id = ?',
      [templateId],
    );
    await db.runAsync(
      `INSERT INTO template_exercise (
         id, template_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, rest_sec, notes
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, templateId, exerciseId, row?.next ?? 0, options.targetSets ?? 3,
        options.targetRepsMin ?? null, options.targetRepsMax ?? null, options.restSec ?? null,
        options.notes ?? null],
    );
    await this.update(templateId, {});
    return id;
  },

  async updateExercise(
    templateExerciseId: string,
    patch: { targetSets?: number | null; targetRepsMin?: number | null; targetRepsMax?: number | null; restSec?: number | null; notes?: string | null },
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.targetSets !== undefined) {
      fields.push('target_sets = ?');
      params.push(patch.targetSets);
    }
    if (patch.targetRepsMin !== undefined) {
      fields.push('target_reps_min = ?');
      params.push(patch.targetRepsMin);
    }
    if (patch.targetRepsMax !== undefined) {
      fields.push('target_reps_max = ?');
      params.push(patch.targetRepsMax);
    }
    if (patch.restSec !== undefined) {
      fields.push('rest_sec = ?');
      params.push(patch.restSec);
    }
    if (patch.notes !== undefined) {
      fields.push('notes = ?');
      params.push(patch.notes);
    }
    if (fields.length === 0) return;
    params.push(templateExerciseId);
    await db.runAsync(`UPDATE template_exercise SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async removeExercise(templateExerciseId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM template_exercise WHERE id = ?', [templateExerciseId]);
  },

  async reorderExercises(templateId: string, orderedIds: string[]): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await tx.runAsync('UPDATE template_exercise SET position = ? WHERE id = ? AND template_id = ?', [
          i, orderedIds[i], templateId,
        ]);
      }
    });
  },

  async markUsed(templateId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE workout_template SET last_used_at = ?, use_count = use_count + 1, updated_at = ? WHERE id = ?',
      [Date.now(), Date.now(), templateId],
    );
  },
};
