#!/usr/bin/env node
/**
 * Сборка каталога: scripts/catalog/*.mjs → assets/catalog/exercises.json
 *
 * Скрипт намеренно строгий: он падает, если у упражнения неизвестная категория,
 * мышца, оборудование, дублируется slug или отсутствует лицензия.
 * Лучше сломать сборку каталога, чем получить мусор в базе на телефоне.
 *
 * Запуск: npm run build:catalog
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { part as part1 } from './catalog/01-chest-back.mjs';
import { part as part2 } from './catalog/02-shoulders-arms.mjs';
import { part as part3 } from './catalog/03-legs.mjs';
import { part as part4 } from './catalog/04-core-full-cardio.mjs';
import { patternTemplates, equipmentNotes } from './catalog-templates.mjs';

const CATALOG_VERSION = 1;
const LICENSE = 'gymlog-own';
const ATTRIBUTION = 'Тексты техники подготовлены для проекта GymLog';

const VALID = {
  category: ['bodybuilding', 'powerlifting', 'weightlifting', 'calisthenics', 'functional', 'crossfit',
    'core', 'cardio', 'plyometrics', 'mobility', 'stretching', 'balance', 'rehab', 'sport'],
  metricType: ['weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_reps', 'reps_only',
    'duration', 'weight_duration', 'distance_duration'],
  pattern: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge',
    'lunge', 'carry', 'rotation', 'isolation', 'gait', 'jump', 'static'],
  muscle: ['chest', 'back', 'lats', 'traps', 'lower_back', 'shoulders', 'biceps', 'triceps', 'forearms',
    'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'abs', 'obliques', 'neck',
    'full_body', 'cardio'],
  equipment: ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'smith', 'bodyweight', 'band',
    'trx', 'ez_bar', 'plate', 'medicine_ball', 'box', 'bench', 'sled', 'rope', 'cardio_machine', 'other'],
  difficulty: ['beginner', 'intermediate', 'advanced'],
  pushPull: ['push', 'pull', 'static', 'none'],
  laterality: ['bilateral', 'unilateral', 'alternating'],
};

const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitAliases(value) {
  if (!value) return [];
  return String(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Нормализация для поиска: нижний регистр, ё → е, схлопывание пробелов. */
export function normalizeSearch(text) {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function buildInstructions(entry) {
  const template = patternTemplates[entry.p] ?? patternTemplates.isolation;
  const instructions = [];
  let position = 0;

  const overview = entry.ov ?? template.overview;
  instructions.push({ kind: 'overview', position: position++, text: overview });

  const steps = entry.st ?? template.steps ?? [];
  steps.forEach((text) => instructions.push({ kind: 'step', position: position++, text }));

  const mistakes = entry.mi ?? template.mistakes ?? [];
  mistakes.forEach((text) => instructions.push({ kind: 'mistake', position: position++, text }));

  const tips = [...(entry.ti ?? template.tips ?? [])];
  for (const eq of splitList(entry.eq)) {
    if (equipmentNotes[eq] && !entry.ti) tips.push(equipmentNotes[eq]);
  }
  tips.forEach((text) => instructions.push({ kind: 'tip', position: position++, text }));

  return instructions;
}

function expand(entry) {
  const slug = entry.s;
  check(!!slug, `Упражнение без slug: ${JSON.stringify(entry).slice(0, 80)}`);
  check(!!entry.ru, `[${slug}] нет русского названия`);
  check(VALID.category.includes(entry.c), `[${slug}] неизвестная категория: ${entry.c}`);
  check(VALID.pattern.includes(entry.p), `[${slug}] неизвестный паттерн: ${entry.p}`);

  const metricType = entry.m ?? 'weight_reps';
  check(VALID.metricType.includes(metricType), `[${slug}] неизвестный тип измерения: ${metricType}`);

  const difficulty = entry.d ?? 'intermediate';
  check(VALID.difficulty.includes(difficulty), `[${slug}] неизвестная сложность: ${difficulty}`);

  const laterality = entry.lat ?? 'bilateral';
  check(VALID.laterality.includes(laterality), `[${slug}] неизвестная латеральность: ${laterality}`);

  const pushPull = entry.pp ?? null;
  check(pushPull === null || VALID.pushPull.includes(pushPull), `[${slug}] неизвестный push/pull: ${pushPull}`);

  const primary = splitList(entry.pm);
  const secondary = splitList(entry.sm);
  const equipment = splitList(entry.eq);
  check(primary.length > 0, `[${slug}] не указаны основные мышцы`);
  check(equipment.length > 0, `[${slug}] не указано оборудование`);
  [...primary, ...secondary].forEach((m) =>
    check(VALID.muscle.includes(m), `[${slug}] неизвестная мышца: ${m}`),
  );
  equipment.forEach((e) => check(VALID.equipment.includes(e), `[${slug}] неизвестное оборудование: ${e}`));

  const aliases = splitAliases(entry.al);
  const tags = splitList(entry.tg);
  const instructions = buildInstructions(entry);

  const searchBlob = normalizeSearch(
    [entry.ru, entry.en ?? '', ...aliases, ...primary, ...secondary, ...equipment, ...tags].join(' '),
  );

  return {
    id: `ex_${slug}`,
    slug,
    nameRu: entry.ru,
    nameEn: entry.en ?? null,
    familyId: entry.f ?? null,
    category: entry.c,
    movementPattern: entry.p,
    metricType,
    difficulty,
    isCompound: entry.comp === true,
    pushPull,
    laterality,
    defaultRestSec: entry.rest ?? null,
    popularity: entry.pop ?? 10,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    equipment,
    aliases,
    tags,
    instructions,
    searchBlob,
    license: LICENSE,
    attribution: ATTRIBUTION,
  };
}

const raw = [...part1, ...part2, ...part3, ...part4];
const exercises = raw.map(expand);

const seen = new Set();
for (const exercise of exercises) {
  if (seen.has(exercise.slug)) errors.push(`Дубликат slug: ${exercise.slug}`);
  seen.add(exercise.slug);
}

if (errors.length > 0) {
  console.error(`\n❌ Каталог не собран, ошибок: ${errors.length}\n`);
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}

exercises.sort((a, b) => b.popularity - a.popularity || a.slug.localeCompare(b.slug));

const output = {
  version: CATALOG_VERSION,
  generatedAt: new Date().toISOString().slice(0, 10),
  license: LICENSE,
  attribution: ATTRIBUTION,
  count: exercises.length,
  exercises,
};

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'assets', 'catalog', 'exercises.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(output), 'utf8');

const families = new Set(exercises.map((e) => e.familyId).filter(Boolean));
const byCategory = {};
for (const e of exercises) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

console.log(`✅ Каталог собран: ${exercises.length} упражнений, ${families.size} семейств`);
console.log(`   Файл: assets/catalog/exercises.json (${(JSON.stringify(output).length / 1024).toFixed(0)} КБ)`);
console.log('   По категориям:', byCategory);
