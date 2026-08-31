import { compareSessions, findTopSet } from '@/analytics/comparison';
import type { AnalyticsExercise, AnalyticsSet } from '@/analytics/types';

const ctx = { bodyWeightKg: 80 };

function set(id: string, weightKg: number, reps: number): AnalyticsSet {
  return {
    id, setType: 'working', isCompleted: true, weightKg, reps,
    durationSec: null, distanceM: null, assistKg: null, addedWeightKg: null, rir: null, rpe: null,
  };
}

function bench(sets: AnalyticsSet[]): AnalyticsExercise {
  return {
    id: 'we', exerciseId: 'ex_bench', name: 'Жим штанги лёжа',
    metricType: 'weight_reps', primaryMuscle: 'chest', sets,
  };
}

describe('сравнение тренировок', () => {
  it('находит топовый подход по весу, при равенстве — по повторам', () => {
    const top = findTopSet(bench([set('a', 80, 8), set('b', 80, 10), set('c', 75, 12)]), ctx);
    expect(top).toEqual({ weightKg: 80, reps: 10 });
  });

  it('считает разницу веса и объёма', () => {
    const current = { exercises: [bench([set('a', 82.5, 8), set('b', 82.5, 8)])], durationSec: 3600 };
    const previous = { exercises: [bench([set('c', 80, 8), set('d', 80, 8)])], durationSec: 3000 };

    const result = compareSessions(current, previous, ctx);

    expect(result.volumeKg).toBe(1320);
    expect(result.previousVolumeKg).toBe(1280);
    expect(result.volumeChangePct).toBeCloseTo(3.125, 3);
    expect(result.durationDeltaSec).toBe(600);
    expect(result.exercises[0].weightDeltaKg).toBeCloseTo(2.5, 5);
    expect(result.exercises[0].verdict).toBe('better');
  });

  it('помечает новое упражнение как new', () => {
    const current = { exercises: [bench([set('a', 60, 10)])], durationSec: null };
    const previous = { exercises: [], durationSec: null };
    expect(compareSessions(current, previous, ctx).exercises[0].verdict).toBe('new');
  });
});
