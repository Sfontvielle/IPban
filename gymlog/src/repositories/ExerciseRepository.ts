import type {
  Category,
  Difficulty,
  Equipment,
  Laterality,
  MetricType,
  MovementPattern,
  MuscleGroup,
  PushPull,
} from '@/constants/enums';
import { getDatabase } from '@/db/client';
import { isFtsAvailable, normalize } from '@/db/seed/CatalogSeeder';
import type { Exercise, ExerciseDetail, ExerciseInstruction, ExerciseListItem } from '@/types/domain';
import { newId } from '@/utils/id';

export interface ExerciseFilters {
  query?: string;
  muscles?: MuscleGroup[];
  equipment?: Equipment[];
  categories?: Category[];
  patterns?: MovementPattern[];
  difficulties?: Difficulty[];
  compound?: 'compound' | 'isolation' | null;
  pushPull?: PushPull | null;
  laterality?: Laterality | null;
  customOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface ListRow {
  id: string;
  name_ru: string;
  name_en: string | null;
  metric_type: string;
  is_custom: number;
  image_uri: string | null;
  primary_muscle: string | null;
  equipment: string | null;
}

function mapListRow(row: ListRow): ExerciseListItem {
  return {
    id: row.id,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    metricType: row.metric_type as MetricType,
    primaryMuscle: (row.primary_muscle as MuscleGroup) ?? null,
    equipment: (row.equipment as Equipment) ?? null,
    isCustom: row.is_custom === 1,
    imageUri: row.image_uri,
  };
}

const LIST_COLUMNS = `
  e.id, e.name_ru, e.name_en, e.metric_type, e.is_custom, e.image_uri,
  (SELECT m.muscle FROM exercise_muscle m
    WHERE m.exercise_id = e.id AND m.role = 'primary'
    ORDER BY m.position LIMIT 1) AS primary_muscle,
  (SELECT q.equipment FROM exercise_equipment q
    WHERE q.exercise_id = e.id
    ORDER BY q.is_primary DESC LIMIT 1) AS equipment
`;

/** Токены запроса → выражение FTS5 с префиксным поиском. */
export function buildFtsQuery(query: string): string | null {
  const tokens = normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

let ftsChecked: boolean | null = null;

async function ftsEnabled(): Promise<boolean> {
  if (ftsChecked !== null) return ftsChecked;
  const db = await getDatabase();
  ftsChecked = await isFtsAvailable(db);
  return ftsChecked;
}

function buildFilterClauses(filters: ExerciseFilters): { sql: string; params: (string | number)[] } {
  const clauses: string[] = ['e.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters.customOnly) clauses.push('e.is_custom = 1');

  if (filters.muscles?.length) {
    clauses.push(
      `EXISTS (SELECT 1 FROM exercise_muscle m WHERE m.exercise_id = e.id
        AND m.muscle IN (${filters.muscles.map(() => '?').join(',')}))`,
    );
    params.push(...filters.muscles);
  }
  if (filters.equipment?.length) {
    clauses.push(
      `EXISTS (SELECT 1 FROM exercise_equipment q WHERE q.exercise_id = e.id
        AND q.equipment IN (${filters.equipment.map(() => '?').join(',')}))`,
    );
    params.push(...filters.equipment);
  }
  if (filters.categories?.length) {
    clauses.push(`e.category IN (${filters.categories.map(() => '?').join(',')})`);
    params.push(...filters.categories);
  }
  if (filters.patterns?.length) {
    clauses.push(`e.movement_pattern IN (${filters.patterns.map(() => '?').join(',')})`);
    params.push(...filters.patterns);
  }
  if (filters.difficulties?.length) {
    clauses.push(`e.difficulty IN (${filters.difficulties.map(() => '?').join(',')})`);
    params.push(...filters.difficulties);
  }
  if (filters.compound === 'compound') clauses.push('e.is_compound = 1');
  if (filters.compound === 'isolation') clauses.push('e.is_compound = 0');
  if (filters.pushPull) {
    clauses.push('e.push_pull = ?');
    params.push(filters.pushPull);
  }
  if (filters.laterality) {
    clauses.push('e.laterality = ?');
    params.push(filters.laterality);
  }

  return { sql: clauses.join(' AND '), params };
}

export const ExerciseRepository = {
  /**
   * Поиск по каталогу. При наличии FTS5 — полнотекстовый с ранжированием,
   * иначе — резервный LIKE по денормализованной строке search_blob.
   */
  async search(filters: ExerciseFilters): Promise<ExerciseListItem[]> {
    const db = await getDatabase();
    const limit = filters.limit ?? 60;
    const offset = filters.offset ?? 0;
    const { sql: filterSql, params: filterParams } = buildFilterClauses(filters);
    const query = filters.query?.trim() ?? '';

    if (query.length >= 2 && (await ftsEnabled())) {
      const match = buildFtsQuery(query);
      if (match) {
        const rows = await db.getAllAsync<ListRow>(
          `SELECT ${LIST_COLUMNS},
             bm25(exercise_fts, 0.0, 10.0, 8.0, 5.0, 3.0, 3.0, 2.0) AS rank
           FROM exercise_fts
           JOIN exercise e ON e.id = exercise_fts.exercise_id
           WHERE exercise_fts MATCH ? AND ${filterSql}
           ORDER BY rank ASC, e.popularity DESC
           LIMIT ? OFFSET ?`,
          [match, ...filterParams, limit, offset],
        );
        if (rows.length > 0 || offset > 0) return rows.map(mapListRow);
      }
    }

    const likeClauses: string[] = [];
    const likeParams: string[] = [];
    if (query.length > 0) {
      for (const token of normalize(query).split(/\s+/).filter(Boolean)) {
        likeClauses.push('e.search_blob LIKE ?');
        likeParams.push(`%${token}%`);
      }
    }

    const where = [filterSql, ...likeClauses].join(' AND ');
    const rows = await db.getAllAsync<ListRow>(
      `SELECT ${LIST_COLUMNS} FROM exercise e
       WHERE ${where}
       ORDER BY e.popularity DESC, e.name_ru COLLATE NOCASE
       LIMIT ? OFFSET ?`,
      [...filterParams, ...likeParams, limit, offset],
    );
    return rows.map(mapListRow);
  },

  async listByIds(ids: string[]): Promise<ExerciseListItem[]> {
    if (ids.length === 0) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync<ListRow>(
      `SELECT ${LIST_COLUMNS} FROM exercise e WHERE e.id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    const byId = new Map(rows.map((row) => [row.id, mapListRow(row)]));
    return ids.map((id) => byId.get(id)).filter((item): item is ExerciseListItem => !!item);
  },

  /** Упражнения, которые пользователь выполнял недавно. */
  async listRecentlyUsed(limit = 12): Promise<ExerciseListItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ListRow>(
      `SELECT ${LIST_COLUMNS}, MAX(s.started_at) AS last_at
       FROM exercise e
       JOIN workout_exercise we ON we.exercise_id = e.id
       JOIN workout_session s ON s.id = we.session_id AND s.status = 'completed' AND s.deleted_at IS NULL
       WHERE e.deleted_at IS NULL
       GROUP BY e.id
       ORDER BY last_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(mapListRow);
  },

  async getById(id: string): Promise<ExerciseDetail | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM exercise WHERE id = ?',
      [id],
    );
    if (!row) return null;

    const [muscles, equipment, aliases, tags, instructions] = await Promise.all([
      db.getAllAsync<{ muscle: string; role: string }>(
        'SELECT muscle, role FROM exercise_muscle WHERE exercise_id = ? ORDER BY role, position',
        [id],
      ),
      db.getAllAsync<{ equipment: string }>(
        'SELECT equipment FROM exercise_equipment WHERE exercise_id = ? ORDER BY is_primary DESC',
        [id],
      ),
      db.getAllAsync<{ name: string }>('SELECT name FROM exercise_alias WHERE exercise_id = ?', [id]),
      db.getAllAsync<{ tag: string }>('SELECT tag FROM exercise_tag WHERE exercise_id = ?', [id]),
      db.getAllAsync<{ id: string; kind: string; position: number; text: string }>(
        'SELECT id, kind, position, text FROM exercise_instruction WHERE exercise_id = ? ORDER BY position',
        [id],
      ),
    ]);

    const base = mapExerciseRow(row);
    return {
      ...base,
      primaryMuscles: muscles.filter((m) => m.role === 'primary').map((m) => m.muscle as MuscleGroup),
      secondaryMuscles: muscles.filter((m) => m.role === 'secondary').map((m) => m.muscle as MuscleGroup),
      equipment: equipment.map((e) => e.equipment as Equipment),
      aliases: aliases.map((a) => a.name),
      tags: tags.map((t) => t.tag),
      instructions: instructions as ExerciseInstruction[],
    };
  },

  /**
   * Подбор замены — алгоритмический, без AI: сначала то же семейство,
   * затем те же основные мышцы и паттерн движения.
   */
  async findSubstitutes(exerciseId: string, limit = 10): Promise<ExerciseListItem[]> {
    const db = await getDatabase();
    const source = await db.getFirstAsync<{
      family_id: string | null;
      movement_pattern: string | null;
    }>('SELECT family_id, movement_pattern FROM exercise WHERE id = ?', [exerciseId]);
    if (!source) return [];

    const rows = await db.getAllAsync<ListRow & { score: number }>(
      `SELECT ${LIST_COLUMNS},
        (CASE WHEN e.family_id IS NOT NULL AND e.family_id = ? THEN 100 ELSE 0 END)
        + (CASE WHEN e.movement_pattern = ? THEN 40 ELSE 0 END)
        + (SELECT COUNT(*) * 25 FROM exercise_muscle a
            JOIN exercise_muscle b ON a.muscle = b.muscle AND a.role = b.role
            WHERE a.exercise_id = e.id AND b.exercise_id = ? AND a.role = 'primary')
        + (SELECT COUNT(*) * 5 FROM exercise_muscle a
            JOIN exercise_muscle b ON a.muscle = b.muscle
            WHERE a.exercise_id = e.id AND b.exercise_id = ? AND a.role = 'secondary')
        + e.popularity / 20 AS score
       FROM exercise e
       WHERE e.id != ? AND e.deleted_at IS NULL
       ORDER BY score DESC, e.popularity DESC
       LIMIT ?`,
      [source.family_id, source.movement_pattern, exerciseId, exerciseId, exerciseId, limit],
    );

    return rows.filter((row) => row.score > 20).map(mapListRow);
  },

  async createCustom(input: {
    nameRu: string;
    nameEn?: string | null;
    metricType: MetricType;
    category: Category;
    movementPattern?: MovementPattern | null;
    primaryMuscles: MuscleGroup[];
    secondaryMuscles?: MuscleGroup[];
    equipment: Equipment[];
    notes?: string | null;
    defaultRestSec?: number | null;
    imageUri?: string | null;
  }): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    const slug = `user-${id.slice(0, 8)}`;
    const searchBlob = normalize(
      [input.nameRu, input.nameEn ?? '', ...input.primaryMuscles, ...(input.secondaryMuscles ?? []), ...input.equipment].join(' '),
    );

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO exercise (
           id, slug, name_ru, name_en, family_id, category, movement_pattern, metric_type,
           difficulty, is_compound, push_pull, laterality, default_rest_sec, popularity,
           is_custom, source, image_uri, license, attribution, search_blob, created_at, updated_at
         ) VALUES (?,?,?,?,NULL,?,?,?,NULL,0,NULL,'bilateral',?,50,1,'user',?,'user','',?,?,?)`,
        [id, slug, input.nameRu, input.nameEn ?? null, input.category, input.movementPattern ?? null,
          input.metricType, input.defaultRestSec ?? null, input.imageUri ?? null, searchBlob, now, now],
      );
      let position = 0;
      for (const muscle of input.primaryMuscles) {
        await tx.runAsync(
          'INSERT INTO exercise_muscle (exercise_id, muscle, role, position) VALUES (?,?,?,?)',
          [id, muscle, 'primary', position++],
        );
      }
      position = 0;
      for (const muscle of input.secondaryMuscles ?? []) {
        await tx.runAsync(
          'INSERT INTO exercise_muscle (exercise_id, muscle, role, position) VALUES (?,?,?,?)',
          [id, muscle, 'secondary', position++],
        );
      }
      let index = 0;
      for (const equipment of input.equipment) {
        await tx.runAsync(
          'INSERT INTO exercise_equipment (exercise_id, equipment, is_primary) VALUES (?,?,?)',
          [id, equipment, index === 0 ? 1 : 0],
        );
        index += 1;
      }
      if (input.notes) {
        await tx.runAsync(
          'INSERT INTO exercise_instruction (id, exercise_id, kind, position, text) VALUES (?,?,?,?,?)',
          [newId(), id, 'overview', 0, input.notes],
        );
      }
    });

    if (await ftsEnabled()) {
      await db.runAsync(
        `INSERT INTO exercise_fts (exercise_id, name_ru, name_en, aliases, muscles, equipment, tags)
         VALUES (?,?,?,'',?,?,'')`,
        [
          id,
          normalize(input.nameRu),
          normalize(input.nameEn ?? ''),
          normalize([...input.primaryMuscles, ...(input.secondaryMuscles ?? [])].join(' ')),
          normalize(input.equipment.join(' ')),
        ],
      );
    }

    return id;
  },

  async softDeleteCustom(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE exercise SET deleted_at = ?, updated_at = ? WHERE id = ? AND source = 'user'",
      [Date.now(), Date.now(), id],
    );
  },

  async countAll(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM exercise WHERE deleted_at IS NULL',
    );
    return row?.n ?? 0;
  },
};

function mapExerciseRow(row: Record<string, unknown>): Exercise {
  return {
    id: String(row.id),
    slug: String(row.slug),
    nameRu: String(row.name_ru),
    nameEn: (row.name_en as string) ?? null,
    familyId: (row.family_id as string) ?? null,
    category: row.category as Category,
    movementPattern: (row.movement_pattern as MovementPattern) ?? null,
    metricType: row.metric_type as MetricType,
    difficulty: (row.difficulty as Difficulty) ?? null,
    isCompound: row.is_compound === 1,
    pushPull: (row.push_pull as PushPull) ?? null,
    laterality: (row.laterality as Laterality) ?? null,
    defaultRestSec: (row.default_rest_sec as number) ?? null,
    popularity: Number(row.popularity ?? 0),
    isCustom: row.is_custom === 1,
    source: String(row.source ?? 'builtin'),
    imageUri: (row.image_uri as string) ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: (row.deleted_at as number) ?? null,
  };
}
