import { calculateSessionTotals, calculateSetVolume, effectiveLoadKg } from '@/analytics/volume';
import type { AnalyticsExercise, AnalyticsSet } from '@/analytics/types';

function set(overrides: Partial<AnalyticsSet> = {}): AnalyticsSet {
  return {
    id: overrides.id ?? 's1',
    setType: 'working',
    isCompleted: true,
    weightKg: null,
    reps: null,
    durationSec: null,
    distanceM: null,
    assistKg: null,
    addedWeightKg: null,
    rir: null,
    rpe: null,
    ...overrides,
  };
}

const ctx = { bodyWeightKg: 80 };

describe('объём подхода', () => {
  it('считает вес × повторы', () => {
    expect(calculateSetVolume(set({ weightKg: 80, reps: 8 }), 'weight_reps', ctx)).toBe(640);
  });

  it('не считает разминочные подходы', () => {
    const warmup = set({ weightKg: 60, reps: 10, setType: 'warmup' });
    expect(calculateSetVolume(warmup, 'weight_reps', ctx)).toBe(0);
  });

  it('не считает невыполненные подходы', () => {
    const planned = set({ weightKg: 80, reps: 8, isCompleted: false });
    expect(calculateSetVolume(planned, 'weight_reps', ctx)).toBe(0);
  });

  it('использует вес тела для упражнений со своим весом', () => {
    expect(calculateSetVolume(set({ reps: 10 }), 'bodyweight_reps', ctx)).toBe(800);
  });

  it('прибавляет дополнительный вес к весу тела', () => {
    const s = set({ reps: 5, addedWeightKg: 20 });
    expect(calculateSetVolume(s, 'weighted_bodyweight', ctx)).toBe(500);
  });

  it('вычитает помощь тренажёра', () => {
    const s = set({ reps: 10, assistKg: 30 });
    expect(calculateSetVolume(s, 'assisted_reps', ctx)).toBe(500);
  });

  it('не даёт отрицательного объёма при помощи больше веса тела', () => {
    const s = set({ reps: 10, assistKg: 200 });
    expect(calculateSetVolume(s, 'assisted_reps', ctx)).toBe(0);
  });

  it('не считает объём для времени и расстояния', () => {
    expect(calculateSetVolume(set({ durationSec: 60 }), 'duration', ctx)).toBe(0);
    expect(calculateSetVolume(set({ distanceM: 5000, durationSec: 1500 }), 'distance_duration', ctx)).toBe(0);
    expect(calculateSetVolume(set({ reps: 15 }), 'reps_only', ctx)).toBe(0);
  });

  it('возвращает 0, если вес тела неизвестен', () => {
    expect(calculateSetVolume(set({ reps: 10 }), 'bodyweight_reps', { bodyWeightKg: null })).toBe(0);
  });

  it('считает эффективную нагрузку', () => {
    expect(effectiveLoadKg(set({ weightKg: 100 }), 'weight_reps', ctx)).toBe(100);
    expect(effectiveLoadKg(set({ addedWeightKg: 10 }), 'weighted_bodyweight', ctx)).toBe(90);
  });
});

describe('итоги тренировки', () => {
  const exercises: AnalyticsExercise[] = [
    {
      id: 'we1',
      exerciseId: 'ex_barbell-bench-press',
      name: 'Жим штанги лёжа',
      metricType: 'weight_reps',
      primaryMuscle: 'chest',
      sets: [
        set({ id: 'a', weightKg: 60, reps: 10, setType: 'warmup' }),
        set({ id: 'b', weightKg: 82.5, reps: 8 }),
        set({ id: 'c', weightKg: 82.5, reps: 8 }),
        set({ id: 'd', weightKg: 82.5, reps: 7 }),
      ],
    },
    {
      id: 'we2',
      exerciseId: 'ex_plank',
      name: 'Планка',
      metricType: 'duration',
      primaryMuscle: 'abs',
      sets: [set({ id: 'e', durationSec: 60 })],
    },
  ];

  it('суммирует только рабочие подходы', () => {
    const totals = calculateSessionTotals(exercises, ctx, 4320);
    expect(totals.volumeKg).toBeCloseTo(82.5 * 23, 5);
    expect(totals.workingSets).toBe(4);
    expect(totals.totalReps).toBe(23);
    expect(totals.exercises).toBe(2);
    expect(totals.durationSec).toBe(4320);
  });
});
