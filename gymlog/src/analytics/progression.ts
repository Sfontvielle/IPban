import type { Period } from '@/types/domain';

/** Одно выполнение упражнения — точка на графиках прогресса. */
export interface ExerciseSessionPoint {
  sessionId: string;
  performedAt: number;
  localDate: string;
  maxWeightKg: number;
  bestEst1rmKg: number;
  bestSetVolumeKg: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  maxReps: number;
}

export interface SeriesPoint {
  x: number;
  y: number;
  label: string;
}

export interface ExerciseProgress {
  points: ExerciseSessionPoint[];
  maxWeight: SeriesPoint[];
  est1rm: SeriesPoint[];
  volume: SeriesPoint[];
  reps: SeriesPoint[];
  sessionCount: number;
  firstAt: number | null;
  lastAt: number | null;
  bestWeightKg: number;
  bestEst1rmKg: number;
  bestSetVolumeKg: number;
  totalVolumeKg: number;
  weightChangePct: number | null;
  est1rmChangePct: number | null;
  volumeChangePct: number | null;
}

export function percentChange(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

export function inPeriod(ms: number, period: Period): boolean {
  return ms >= period.fromMs && ms <= period.toMs;
}

/**
 * Сводка прогресса по одному упражнению.
 * На вход — уже отобранные из базы точки, отсортированные по возрастанию даты.
 */
export function calculateExerciseProgress(points: ExerciseSessionPoint[]): ExerciseProgress {
  const sorted = [...points].sort((a, b) => a.performedAt - b.performedAt);

  const series = (pick: (p: ExerciseSessionPoint) => number): SeriesPoint[] =>
    sorted.map((point) => ({ x: point.performedAt, y: pick(point), label: point.localDate }));

  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  return {
    points: sorted,
    maxWeight: series((p) => p.maxWeightKg),
    est1rm: series((p) => p.bestEst1rmKg),
    volume: series((p) => p.totalVolumeKg),
    reps: series((p) => p.maxReps),
    sessionCount: sorted.length,
    firstAt: first?.performedAt ?? null,
    lastAt: last?.performedAt ?? null,
    bestWeightKg: sorted.reduce((max, p) => Math.max(max, p.maxWeightKg), 0),
    bestEst1rmKg: sorted.reduce((max, p) => Math.max(max, p.bestEst1rmKg), 0),
    bestSetVolumeKg: sorted.reduce((max, p) => Math.max(max, p.bestSetVolumeKg), 0),
    totalVolumeKg: sorted.reduce((sum, p) => sum + p.totalVolumeKg, 0),
    weightChangePct: first && last ? percentChange(first.maxWeightKg, last.maxWeightKg) : null,
    est1rmChangePct: first && last ? percentChange(first.bestEst1rmKg, last.bestEst1rmKg) : null,
    volumeChangePct: first && last ? percentChange(first.totalVolumeKg, last.totalVolumeKg) : null,
  };
}

/** Скользящее среднее — сглаживает шумные графики (например, вес тела). */
export function movingAverage(points: SeriesPoint[], window: number): SeriesPoint[] {
  if (window <= 1) return points;
  return points.map((point, index) => {
    const from = Math.max(0, index - window + 1);
    const slice = points.slice(from, index + 1);
    const avg = slice.reduce((sum, p) => sum + p.y, 0) / slice.length;
    return { ...point, y: avg };
  });
}

/** Линейный тренд методом наименьших квадратов: знак наклона показывает направление. */
export function linearTrend(points: SeriesPoint[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  if (denominator === 0) return null;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}
