import type { Database } from '@/db/client';
import { newId } from '@/utils/id';

import catalogData from '../../../assets/catalog/exercises.json';

interface CatalogInstruction {
  kind: string;
  position: number;
  text: string;
}

interface CatalogExercise {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string | null;
  familyId: string | null;
  category: string;
  movementPattern: string;
  metricType: string;
  difficulty: string;
  isCompound: boolean;
  pushPull: string | null;
  laterality: string;
  defaultRestSec: number | null;
  popularity: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  aliases: string[];
  tags: string[];
  instructions: CatalogInstruction[];
  searchBlob: string;
  license: string;
  attribution: string;
}

interface CatalogFile {
  version: number;
  count: number;
  license: string;
  attribution: string;
  exercises: CatalogExercise[];
}

const catalog = catalogData as unknown as CatalogFile;

const CHUNK_SIZE = 25;
const META_KEY = 'catalog_version';

export const CATALOG_VERSION = catalog.version;
export const CATALOG_COUNT = catalog.exercises.length;

export async function isFtsAvailable(db: Database): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'exercise_fts'",
  );
  return !!row;
}

async function getInstalledVersion(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM catalog_meta WHERE key = ?',
    [META_KEY],
  );
  return row ? Number(row.value) : 0;
}

async function upsertChunk(
  db: Database,
  chunk: CatalogExercise[],
  now: number,
  withFts: boolean,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const item of chunk) {
      await tx.runAsync(
        `INSERT INTO exercise (
           id, slug, name_ru, name_en, family_id, category, movement_pattern, metric_type,
           difficulty, is_compound, push_pull, laterality, default_rest_sec, popularity,
           is_custom, source, license, attribution, search_blob, created_at, updated_at, deleted_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'builtin',?,?,?,?,?,NULL)
         ON CONFLICT(slug) DO UPDATE SET
           name_ru = excluded.name_ru,
           name_en = excluded.name_en,
           family_id = excluded.family_id,
           category = excluded.category,
           movement_pattern = excluded.movement_pattern,
           metric_type = excluded.metric_type,
           difficulty = excluded.difficulty,
           is_compound = excluded.is_compound,
           push_pull = excluded.push_pull,
           laterality = excluded.laterality,
           default_rest_sec = excluded.default_rest_sec,
           popularity = excluded.popularity,
           license = excluded.license,
           attribution = excluded.attribution,
           search_blob = excluded.search_blob,
           updated_at = excluded.updated_at,
           deleted_at = NULL
         WHERE exercise.source = 'builtin'`,
        [
          item.id, item.slug, item.nameRu, item.nameEn, item.familyId, item.category,
          item.movementPattern, item.metricType, item.difficulty, item.isCompound ? 1 : 0,
          item.pushPull, item.laterality, item.defaultRestSec, item.popularity,
          item.license, item.attribution, item.searchBlob, now, now,
        ],
      );

      // Дочерние таблицы перезаписываем целиком — так проще и надёжнее, чем diff.
      await tx.runAsync('DELETE FROM exercise_alias WHERE exercise_id = ?', [item.id]);
      await tx.runAsync('DELETE FROM exercise_muscle WHERE exercise_id = ?', [item.id]);
      await tx.runAsync('DELETE FROM exercise_equipment WHERE exercise_id = ?', [item.id]);
      await tx.runAsync('DELETE FROM exercise_tag WHERE exercise_id = ?', [item.id]);
      await tx.runAsync('DELETE FROM exercise_instruction WHERE exercise_id = ?', [item.id]);

      for (const alias of item.aliases) {
        await tx.runAsync('INSERT INTO exercise_alias (id, exercise_id, name) VALUES (?,?,?)', [
          newId(), item.id, alias,
        ]);
      }
      let musclePosition = 0;
      for (const muscle of item.primaryMuscles) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO exercise_muscle (exercise_id, muscle, role, position) VALUES (?,?,?,?)',
          [item.id, muscle, 'primary', musclePosition++],
        );
      }
      musclePosition = 0;
      for (const muscle of item.secondaryMuscles) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO exercise_muscle (exercise_id, muscle, role, position) VALUES (?,?,?,?)',
          [item.id, muscle, 'secondary', musclePosition++],
        );
      }
      let equipmentIndex = 0;
      for (const equipment of item.equipment) {
        await tx.runAsync(
          'INSERT OR REPLACE INTO exercise_equipment (exercise_id, equipment, is_primary) VALUES (?,?,?)',
          [item.id, equipment, equipmentIndex === 0 ? 1 : 0],
        );
        equipmentIndex += 1;
      }
      for (const tag of item.tags) {
        await tx.runAsync('INSERT OR REPLACE INTO exercise_tag (exercise_id, tag) VALUES (?,?)', [
          item.id, tag,
        ]);
      }
      for (const instruction of item.instructions) {
        await tx.runAsync(
          'INSERT INTO exercise_instruction (id, exercise_id, kind, position, text) VALUES (?,?,?,?,?)',
          [newId(), item.id, instruction.kind, instruction.position, instruction.text],
        );
      }

      if (withFts) {
        await tx.runAsync('DELETE FROM exercise_fts WHERE exercise_id = ?', [item.id]);
        await tx.runAsync(
          `INSERT INTO exercise_fts (exercise_id, name_ru, name_en, aliases, muscles, equipment, tags)
           VALUES (?,?,?,?,?,?,?)`,
          [
            item.id,
            normalize(item.nameRu),
            normalize(item.nameEn ?? ''),
            normalize(item.aliases.join(' ')),
            normalize([...item.primaryMuscles, ...item.secondaryMuscles].join(' ')),
            normalize(item.equipment.join(' ')),
            normalize(item.tags.join(' ')),
          ],
        );
      }
    }
  });
}

/** Та же нормализация, что и в поиске: ё → е, нижний регистр. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export interface SeedResult {
  applied: boolean;
  version: number;
  count: number;
  ftsEnabled: boolean;
}

/**
 * Импорт каталога. Выполняется при первом запуске и при росте версии каталога.
 * Пользовательские упражнения (source = 'user') не затрагиваются никогда.
 */
export async function seedCatalog(db: Database): Promise<SeedResult> {
  const installed = await getInstalledVersion(db);
  const ftsEnabled = await isFtsAvailable(db);

  if (installed === catalog.version) {
    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM exercise WHERE source = 'builtin'",
    );
    if ((row?.n ?? 0) > 0) {
      return { applied: false, version: installed, count: row?.n ?? 0, ftsEnabled };
    }
  }

  const now = Date.now();
  for (let i = 0; i < catalog.exercises.length; i += CHUNK_SIZE) {
    await upsertChunk(db, catalog.exercises.slice(i, i + CHUNK_SIZE), now, ftsEnabled);
  }

  // Упражнения, исчезнувшие из поставки, скрываем, но не удаляем: на них ссылается история.
  const slugs = catalog.exercises.map((item) => `'${item.slug}'`).join(',');
  await db.execAsync(
    `UPDATE exercise SET deleted_at = ${now}
     WHERE source = 'builtin' AND deleted_at IS NULL AND slug NOT IN (${slugs})`,
  );

  await db.runAsync(
    'INSERT INTO catalog_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [META_KEY, String(catalog.version)],
  );
  await db.execAsync('ANALYZE');

  return { applied: true, version: catalog.version, count: catalog.exercises.length, ftsEnabled };
}
