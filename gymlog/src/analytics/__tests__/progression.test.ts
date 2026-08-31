import { calculateExerciseProgress, linearTrend, movingAverage, percentChange } from '@/analytics/progression';
import { detectPlateau } from '@/analytics/plateau';
import { calculateTrainingFrequency } from '@/analytics/frequency';
import { DAY_MS } from '@/utils/date';

const NOW = new Date('2026-08-31T12:00:00').getTime();

function point(daysAgo: number, weight: number, oneRm: number, volume: number) {
  return {
    sessionId: `s${daysAgo}`,
    performedAt: NOW - daysAgo * DAY_MS,
    localDate: '2026-08-01',
    maxWeightKg: weight,
    bestEst1rmKg: oneRm,
    bestSetVolumeKg: volume / 3,
    totalVolumeKg: volume,
    totalSets: 3,
    totalReps: 24,
    maxReps: 8,
  };
}

describe('прогресс по упражнению', () => {
  it('считает лучшие значения и изменение в процентах', () => {
    const progress = calculateExerciseProgress([
      point(21, 80, 101.3, 1920),
      point(14, 80, 101.3, 1920),
      point(7, 82.5, 104.5, 1980),
    ]);

    expect(progress.sessionCount).toBe(3);
    expect(progress.bestWeightKg).toBe(82.5);
    expect(progress.bestEst1rmKg).toBeCloseTo(104.5, 5);
    expect(progress.weightChangePct).toBeCloseTo(3.125, 3);
    expect(progress.maxWeight).toHaveLength(3);
    expect(progress.maxWeight[0].y).toBe(80);
  });

  it('percentChange не делит на ноль', () => {
    expect(percentChange(0, 100)).toBeNull();
  });

  it('скользящее среднее сглаживает ряд', () => {
    const series = [
      { x: 1, y: 10, label: '' },
      { x: 2, y: 20, label: '' },
      { x: 3, y: 30, label: '' },
    ];
    expect(movingAverage(series, 2).map((p) => p.y)).toEqual([10, 15, 25]);
  });

  it('линейный тренд определяет направление', () => {
    const up = linearTrend([
      { x: 0, y: 1, label: '' },
      { x: 1, y: 2, label: '' },
      { x: 2, y: 3, label: '' },
    ]);
    expect(up?.slope).toBeCloseTo(1, 6);
  });
});

describe('застой', () => {
  it('видит отсутствие прогресса', () => {
    const result = detectPlateau(
      [point(28, 80, 101.3, 1920), point(21, 80, 101.3, 1925), point(14, 80, 101.3, 1918), point(7, 80, 101.3, 1920)],
      NOW,
    );
    expect(result.isPlateau).toBe(true);
    expect(result.sessionsAnalyzed).toBe(4);
  });

  it('не считает застоем растущие результаты', () => {
    const result = detectPlateau(
      [point(28, 75, 95, 1700), point(21, 77.5, 98, 1800), point(14, 80, 101, 1900), point(7, 82.5, 104.5, 2000)],
      NOW,
    );
    expect(result.isPlateau).toBe(false);
  });

  it('не делает выводов при малом числе данных', () => {
    const result = detectPlateau([point(7, 80, 101, 1900)], NOW);
    expect(result.isPlateau).toBe(false);
    expect(result.reason).toBe('мало данных');
  });
});

describe('частота тренировок', () => {
  it('считает тренировки в неделю и промежутки', () => {
    const timestamps = [NOW - 2 * DAY_MS, NOW - 5 * DAY_MS, NOW - 9 * DAY_MS, NOW - 12 * DAY_MS];
    const result = calculateTrainingFrequency(
      timestamps,
      { fromMs: NOW - 28 * DAY_MS, toMs: NOW },
      NOW,
    );
    expect(result.sessions).toBe(4);
    expect(result.perWeek).toBeCloseTo(1, 1);
    expect(result.daysSinceLast).toBe(2);
    expect(result.longestGapDays).toBe(4);
  });

  it('возвращает пустой результат без тренировок', () => {
    const result = calculateTrainingFrequency([], { fromMs: NOW - DAY_MS, toMs: NOW }, NOW);
    expect(result.sessions).toBe(0);
    expect(result.daysSinceLast).toBeNull();
  });
});
