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

const CHUNK_SIZE = 20;
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

/**
 * Многострочная вставка: одна инструкция вместо N.
 * На первом запуске это разница между «секунда» и «десять секунд» на телефоне.
 */
async function insertMany(
  tx: Database,
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  if (rows.length === 0) return;
  const placeholder = `(${columns.map(() => '?').join(',')})`;
  // SQLite ограничивает число параметров в одном запросе — режем на безопасные порции.
  const perStatement = Math.max(1, Math.floor(400 / columns.length));

  for (let i = 0; i < rows.length; i += perStatement) {
    const slice = rows.slice(i, i + perStatement);
    const sql =
      `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES ` +
      slice.map(() => placeholder).join(',');
    await tx.runAsync(sql, slice.flat());
  }
}

async function upsertChunk(
  db: Database,
  chunk: CatalogExercise[],
  now: number,
  withFts: boolean,
  isFreshInstall: boolean,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const aliases: (string | number | null)[][] = [];
    const muscles: (string | number | null)[][] = [];
    const equipment: (string | number | null)[][] = [];
    const tags: (string | number | null)[][] = [];
    const instructions: (string | number | null)[][] = [];
    const ftsRows: (string | number | null)[][] = [];

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

      // На чистой установке удалять нечего — пропускаем лишние запросы.
      if (!isFreshInstall) {
        await tx.runAsync('DELETE FROM exercise_alias WHERE exercise_id = ?', [item.id]);
        await tx.runAsync('DELETE FROM exercise_muscle WHERE exercise_id = ?', [item.id]);
        await tx.runAsync('DELETE FROM exercise_equipment WHERE exercise_id = ?', [item.id]);
        await tx.runAsync('DELETE FROM exercise_tag WHERE exercise_id = ?', [item.id]);
        await tx.runAsync('DELETE FROM exercise_instruction WHERE exercise_id = ?', [item.id]);
        if (withFts) await tx.runAsync('DELETE FROM exercise_fts WHERE exercise_id = ?', [item.id]);
      }

      for (const alias of item.aliases) aliases.push([newId(), item.id, alias]);
      item.primaryMuscles.forEach((muscle, index) =>
        muscles.push([item.id, muscle, 'primary', index]));
      item.secondaryMuscles.forEach((muscle, index) =>
        muscles.push([item.id, muscle, 'secondary', index]));
      item.equipment.forEach((value, index) =>
        equipment.push([item.id, value, index === 0 ? 1 : 0]));
      for (const tag of item.tags) tags.push([item.id, tag]);
      for (const instruction of item.instructions) {
        instructions.push([newId(), item.id, instruction.kind, instruction.position, instruction.text]);
      }

      if (withFts) {
        ftsRows.push([
          item.id,
          normalize(item.nameRu),
          normalize(item.nameEn ?? ''),
          normalize(item.aliases.join(' ')),
          normalize([...item.primaryMuscles, ...item.secondaryMuscles].join(' ')),
          normalize(item.equipment.join(' ')),
          normalize(item.tags.join(' ')),
        ]);
      }
    }

    await insertMany(tx, 'exercise_alias', ['id', 'exercise_id', 'name'], aliases);
    await insertMany(tx, 'exercise_muscle', ['exercise_id', 'muscle', 'role', 'position'], muscles);
    await insertMany(tx, 'exercise_equipment', ['exercise_id', 'equipment', 'is_primary'], equipment);
    await insertMany(tx, 'exercise_tag', ['exercise_id', 'tag'], tags);
    await insertMany(
      tx,
      'exercise_instruction',
      ['id', 'exercise_id', 'kind', 'position', 'text'],
      instructions,
    );
    if (withFts) {
      try {
        await insertMany(
          tx,
          'exercise_fts',
          ['exercise_id', 'name_ru', 'name_en', 'aliases', 'muscles', 'equipment', 'tags'],
          ftsRows,
        );
      } catch (error) {
        // Поисковый индекс — не критичные данные: поиск переживёт это на LIKE-фолбэке.
        console.warn('[gymlog] не удалось наполнить поисковый индекс', error);
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

/** Пауза между порциями: отдаём управление интерфейсу, чтобы приложение не «залипало». */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Импорт каталога. Выполняется при первом запуске и при росте версии каталога.
 * Пользовательские упражнения (source = 'user') не затрагиваются никогда.
 */
export async function seedCatalog(
  db: Database,
  onProgress?: (done: number, total: number) => void,
): Promise<SeedResult> {
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
  const isFreshInstall = installed === 0;
  const total = catalog.exercises.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    await upsertChunk(db, catalog.exercises.slice(i, i + CHUNK_SIZE), now, ftsEnabled, isFreshInstall);
    onProgress?.(Math.min(i + CHUNK_SIZE, total), total);
    await yieldToUi();
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
