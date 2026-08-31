import type { ExerciseSessionPoint } from '@/analytics/progression';
import { daysBetween } from '@/utils/date';

export interface PlateauOptions {
  /** Сколько последних выполнений анализируем. */
  window: number;
  /** Рост меньше этого процента считаем отсутствием прогресса. */
  minGrowthPct: number;
}

export const DEFAULT_PLATEAU_OPTIONS: PlateauOptions = { window: 4, minGrowthPct: 1.5 };

export interface PlateauResult {
  isPlateau: boolean;
  sessionsAnalyzed: number;
  est1rmChangePct: number | null;
  volumeChangePct: number | null;
  daysSinceBest: number | null;
  bestAt: number | null;
  reason: string | null;
}

/**
 * Простое и предсказуемое определение застоя:
 * за последние N выполнений ни расчётный 1ПМ, ни объём не выросли заметно.
 * Никакой «магии» — AI получает результат этой функции, а не выдумывает его сам.
 */
export function detectPlateau(
  points: ExerciseSessionPoint[],
  now: number,
  options: PlateauOptions = DEFAULT_PLATEAU_OPTIONS,
): PlateauResult {
  const sorted = [...points].sort((a, b) => a.performedAt - b.performedAt);
  const window = sorted.slice(-options.window);

  if (window.length < Math.min(3, options.window)) {
    return {
      isPlateau: false,
      sessionsAnalyzed: window.length,
      est1rmChangePct: null,
      volumeChangePct: null,
      daysSinceBest: null,
      bestAt: null,
      reason: 'мало данных',
    };
  }

  const first = window[0];
  const last = window[window.length - 1];

  const change = (from: number, to: number): number | null =>
    from > 0 ? ((to - from) / from) * 100 : null;

  const est1rmChangePct = change(first.bestEst1rmKg, last.bestEst1rmKg);
  const volumeChangePct = change(first.totalVolumeKg, last.totalVolumeKg);

  const best = sorted.reduce(
    (acc, point) => (point.bestEst1rmKg > acc.bestEst1rmKg ? point : acc),
    sorted[0],
  );

  const noStrengthGrowth = est1rmChangePct === null || est1rmChangePct < options.minGrowthPct;
  const noVolumeGrowth = volumeChangePct === null || volumeChangePct < options.minGrowthPct;
  const isPlateau = noStrengthGrowth && noVolumeGrowth;

  return {
    isPlateau,
    sessionsAnalyzed: window.length,
    est1rmChangePct,
    volumeChangePct,
    daysSinceBest: daysBetween(best.performedAt, now),
    bestAt: best.performedAt,
    reason: isPlateau ? 'нет роста ни в силе, ни в объёме' : null,
  };
}
