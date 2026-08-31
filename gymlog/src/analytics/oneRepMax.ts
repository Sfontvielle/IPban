import type { MetricType } from '@/constants/enums';

/**
 * Формула Эпли: 1ПМ = вес × (1 + повторы / 30).
 * Расчёт живёт здесь и только здесь — ни UI, ни AI не считают 1ПМ самостоятельно.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Выше 12 повторов формула сильно завышает — помечаем такие оценки. */
export function isLowConfidence(reps: number): boolean {
  return reps > 12;
}

const ONE_RM_METRICS: MetricType[] = ['weight_reps', 'weighted_bodyweight'];

export function supportsOneRepMax(metricType: MetricType): boolean {
  return ONE_RM_METRICS.includes(metricType);
}

/** Рабочий вес, который даёт нужный процент от 1ПМ. */
export function weightForPercent(oneRepMaxKg: number, percent: number): number {
  return (oneRepMaxKg * percent) / 100;
}

/** Обратная формула Эпли: какой вес нужен для заданного числа повторов. */
export function weightForReps(oneRepMaxKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return oneRepMaxKg;
  return oneRepMaxKg / (1 + reps / 30);
}
