import { REP_MAX_TARGETS, type MetricType, type PrKind } from '@/constants/enums';

import { calculateSetVolume, effectiveLoadKg, isCountedSet } from '@/analytics/volume';
import { estimateOneRepMax, supportsOneRepMax } from '@/analytics/oneRepMax';
import type { AnalyticsExercise, VolumeContext } from '@/analytics/types';

/** Лучшие значения по упражнению ДО текущей тренировки. */
export interface PreviousBests {
  maxWeightKg?: number;
  est1rmKg?: number;
  setVolumeKg?: number;
  sessionVolumeKg?: number;
  /** Ключ — целевое число повторов, значение — лучший вес на это число. */
  repMaxKg?: Record<number, number>;
}

export interface DetectedRecord {
  exerciseId: string;
  exerciseName: string;
  kind: PrKind;
  repTarget: number | null;
  value: number;
  unit: 'kg';
  previousValue: number | null;
  workoutSetId: string | null;
}

function supportsWeightRecords(metricType: MetricType): boolean {
  return metricType === 'weight_reps' || metricType === 'weighted_bodyweight';
}

/**
 * Определение личных рекордов за одну тренировку.
 * Функция чистая: получает подходы и прошлые лучшие значения, возвращает новые рекорды.
 * Рекорды считаются строго внутри одного exerciseId — родственные упражнения не смешиваются.
 */
export function detectPersonalRecords(
  exercise: AnalyticsExercise,
  previous: PreviousBests,
  ctx: VolumeContext,
): DetectedRecord[] {
  if (!exercise.exerciseId) return [];

  const records: DetectedRecord[] = [];
  const base = {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    unit: 'kg' as const,
  };

  const countedSets = exercise.sets.filter(isCountedSet);
  if (countedSets.length === 0) return [];

  // ── Рекорды, требующие веса на снаряде ──
  if (supportsWeightRecords(exercise.metricType)) {
    let bestWeight = { value: 0, setId: null as string | null };
    let best1rm = { value: 0, setId: null as string | null };
    const bestByReps = new Map<number, { value: number; setId: string | null }>();

    for (const set of countedSets) {
      const load = effectiveLoadKg(set, exercise.metricType, ctx);
      const reps = set.reps ?? 0;
      if (load === null || load <= 0 || reps <= 0) continue;

      if (load > bestWeight.value) bestWeight = { value: load, setId: set.id };

      if (supportsOneRepMax(exercise.metricType)) {
        const oneRm = estimateOneRepMax(load, reps);
        if (oneRm > best1rm.value) best1rm = { value: oneRm, setId: set.id };
      }

      for (const target of REP_MAX_TARGETS) {
        if (reps < target) continue;
        const current = bestByReps.get(target);
        if (!current || load > current.value) bestByReps.set(target, { value: load, setId: set.id });
      }
    }

    const previousMaxWeight = previous.maxWeightKg ?? 0;
    if (bestWeight.value > previousMaxWeight) {
      records.push({
        ...base,
        kind: 'max_weight',
        repTarget: null,
        value: bestWeight.value,
        previousValue: previousMaxWeight || null,
        workoutSetId: bestWeight.setId,
      });
    }

    const previous1rm = previous.est1rmKg ?? 0;
    if (best1rm.value > previous1rm) {
      records.push({
        ...base,
        kind: 'est_1rm',
        repTarget: null,
        value: best1rm.value,
        previousValue: previous1rm || null,
        workoutSetId: best1rm.setId,
      });
    }

    for (const [target, candidate] of bestByReps) {
      const previousValue = previous.repMaxKg?.[target] ?? 0;
      if (candidate.value > previousValue) {
        records.push({
          ...base,
          kind: 'rep_max',
          repTarget: target,
          value: candidate.value,
          previousValue: previousValue || null,
          workoutSetId: candidate.setId,
        });
      }
    }
  }

  // ── Объёмные рекорды: работают для любых упражнений с весом или своим весом ──
  let bestSetVolume = { value: 0, setId: null as string | null };
  let sessionVolume = 0;

  for (const set of countedSets) {
    const volume = calculateSetVolume(set, exercise.metricType, ctx);
    sessionVolume += volume;
    if (volume > bestSetVolume.value) bestSetVolume = { value: volume, setId: set.id };
  }

  const previousSetVolume = previous.setVolumeKg ?? 0;
  if (bestSetVolume.value > 0 && bestSetVolume.value > previousSetVolume) {
    records.push({
      ...base,
      kind: 'set_volume',
      repTarget: null,
      value: bestSetVolume.value,
      previousValue: previousSetVolume || null,
      workoutSetId: bestSetVolume.setId,
    });
  }

  const previousSessionVolume = previous.sessionVolumeKg ?? 0;
  if (sessionVolume > 0 && sessionVolume > previousSessionVolume) {
    records.push({
      ...base,
      kind: 'session_volume',
      repTarget: null,
      value: sessionVolume,
      previousValue: previousSessionVolume || null,
      workoutSetId: null,
    });
  }

  return records;
}

/**
 * Какой рекорд показывать пользователю как «главный», если их за упражнение несколько.
 * Приоритет: вес → 1ПМ → повторы → объём.
 */
export function primaryRecord(records: DetectedRecord[]): DetectedRecord | null {
  const order: PrKind[] = ['max_weight', 'est_1rm', 'rep_max', 'set_volume', 'session_volume'];
  for (const kind of order) {
    const found = records.find((record) => record.kind === kind);
    if (found) return found;
  }
  return null;
}
