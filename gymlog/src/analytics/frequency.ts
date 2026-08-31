import { DAY_MS, daysBetween, startOfWeek, toLocalDate } from '@/utils/date';
import type { Period } from '@/types/domain';

export interface FrequencyResult {
  sessions: number;
  days: number;
  perWeek: number;
  averageGapDays: number | null;
  longestGapDays: number | null;
  daysSinceLast: number | null;
  lastAt: number | null;
}

/**
 * Частота тренировок за период. На вход — метки времени тренировок,
 * период задаётся явно (никаких Date.now() внутри — иначе функцию нельзя протестировать).
 */
export function calculateTrainingFrequency(
  timestamps: number[],
  period: Period,
  now: number,
): FrequencyResult {
  const inRange = timestamps.filter((ms) => ms >= period.fromMs && ms <= period.toMs).sort((a, b) => a - b);
  const days = Math.max(1, Math.round((period.toMs - period.fromMs) / DAY_MS));
  const perWeek = (inRange.length / days) * 7;

  let averageGapDays: number | null = null;
  let longestGapDays: number | null = null;

  if (inRange.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < inRange.length; i += 1) {
      gaps.push(daysBetween(inRange[i - 1], inRange[i]));
    }
    averageGapDays = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    longestGapDays = gaps.reduce((max, gap) => Math.max(max, gap), 0);
  }

  const lastAt = inRange.length > 0 ? inRange[inRange.length - 1] : null;

  return {
    sessions: inRange.length,
    days,
    perWeek,
    averageGapDays,
    longestGapDays,
    daysSinceLast: lastAt === null ? null : daysBetween(lastAt, now),
    lastAt,
  };
}

export interface WeeklyBucket {
  weekStart: number;
  label: string;
  sessions: number;
  volumeKg: number;
}

/** Разбивка по неделям — для графика недельного объёма. */
export function bucketByWeek(
  items: { at: number; volumeKg: number }[],
  weeks: number,
  now: number,
  weekStartsOn = 1,
): WeeklyBucket[] {
  const currentWeekStart = startOfWeek(now, weekStartsOn);
  const buckets: WeeklyBucket[] = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = currentWeekStart - i * 7 * DAY_MS;
    buckets.push({ weekStart, label: toLocalDate(weekStart), sessions: 0, volumeKg: 0 });
  }

  for (const item of items) {
    const itemWeek = startOfWeek(item.at, weekStartsOn);
    const bucket = buckets.find((b) => b.weekStart === itemWeek);
    if (bucket) {
      bucket.sessions += 1;
      bucket.volumeKg += item.volumeKg;
    }
  }

  return buckets;
}
