import { COUNTED_SET_TYPES, type MetricType } from '@/constants/enums';

import type { AnalyticsExercise, AnalyticsSet, SessionTotals, VolumeContext } from '@/analytics/types';

/** Подход учитывается в статистике, если он выполнен и не разминочный. */
export function isCountedSet(set: AnalyticsSet): boolean {
  return set.isCompleted && COUNTED_SET_TYPES.includes(set.setType);
}

/**
 * Полная нагрузка подхода в килограммах — то, что реально поднимается.
 * Для упражнений со своим весом учитывается вес тела на дату тренировки.
 */
export function effectiveLoadKg(
  set: AnalyticsSet,
  metricType: MetricType,
  ctx: VolumeContext,
): number | null {
  const bodyWeight = ctx.bodyWeightKg ?? null;
  switch (metricType) {
    case 'weight_reps':
    case 'weight_duration':
      return set.weightKg ?? null;
    case 'bodyweight_reps':
      return bodyWeight;
    case 'weighted_bodyweight': {
      const added = set.addedWeightKg ?? set.weightKg ?? 0;
      return bodyWeight === null ? null : bodyWeight + added;
    }
    case 'assisted_reps': {
      const assist = set.assistKg ?? set.weightKg ?? 0;
      return bodyWeight === null ? null : Math.max(0, bodyWeight - assist);
    }
    default:
      return null;
  }
}

/**
 * Объём подхода в килограммах.
 * Типы измерения без веса (время, расстояние, только повторы) объёма не дают —
 * смешивать секунды с килограммами нельзя.
 */
export function calculateSetVolume(
  set: AnalyticsSet,
  metricType: MetricType,
  ctx: VolumeContext,
): number {
  if (!isCountedSet(set)) return 0;

  const reps = set.reps ?? 0;
  if (reps <= 0) return 0;

  switch (metricType) {
    case 'weight_reps':
    case 'bodyweight_reps':
    case 'weighted_bodyweight':
    case 'assisted_reps': {
      const load = effectiveLoadKg(set, metricType, ctx);
      if (load === null || load <= 0) return 0;
      return load * reps;
    }
    default:
      return 0;
  }
}

export function calculateExerciseVolume(exercise: AnalyticsExercise, ctx: VolumeContext): number {
  return exercise.sets.reduce(
    (sum, set) => sum + calculateSetVolume(set, exercise.metricType, ctx),
    0,
  );
}

export function calculateSessionVolume(
  exercises: AnalyticsExercise[],
  ctx: VolumeContext,
): number {
  return exercises.reduce((sum, exercise) => sum + calculateExerciseVolume(exercise, ctx), 0);
}

export function calculateSessionTotals(
  exercises: AnalyticsExercise[],
  ctx: VolumeContext,
  durationSec: number | null = null,
): SessionTotals {
  let volumeKg = 0;
  let workingSets = 0;
  let totalReps = 0;
  let exerciseCount = 0;

  for (const exercise of exercises) {
    let hasCountedSet = false;
    for (const set of exercise.sets) {
      if (!isCountedSet(set)) continue;
      hasCountedSet = true;
      workingSets += 1;
      totalReps += set.reps ?? 0;
      volumeKg += calculateSetVolume(set, exercise.metricType, ctx);
    }
    if (hasCountedSet) exerciseCount += 1;
  }

  return { volumeKg, workingSets, totalReps, exercises: exerciseCount, durationSec };
}

/** Объём и количество рабочих подходов по группам мышц. */
export function calculateMuscleVolume(
  exercises: AnalyticsExercise[],
  ctx: VolumeContext,
): Record<string, { volumeKg: number; sets: number }> {
  const result: Record<string, { volumeKg: number; sets: number }> = {};

  for (const exercise of exercises) {
    const muscle = exercise.primaryMuscle ?? 'other';
    if (!result[muscle]) result[muscle] = { volumeKg: 0, sets: 0 };
    for (const set of exercise.sets) {
      if (!isCountedSet(set)) continue;
      result[muscle].sets += 1;
      result[muscle].volumeKg += calculateSetVolume(set, exercise.metricType, ctx);
    }
  }

  return result;
}
