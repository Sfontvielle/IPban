import { detectPersonalRecords, type PreviousBests } from '@/analytics/personalRecords';
import type { AnalyticsExercise, AnalyticsSet } from '@/analytics/types';

const ctx = { bodyWeightKg: 80 };

function set(id: string, weightKg: number, reps: number, extra: Partial<AnalyticsSet> = {}): AnalyticsSet {
  return {
    id, setType: 'working', isCompleted: true, weightKg, reps,
    durationSec: null, distanceM: null, assistKg: null, addedWeightKg: null,
    rir: null, rpe: null, ...extra,
  };
}

function bench(sets: AnalyticsSet[]): AnalyticsExercise {
  return {
    id: 'we1',
    exerciseId: 'ex_barbell-bench-press',
    name: 'Жим штанги лёжа',
    metricType: 'weight_reps',
    primaryMuscle: 'chest',
    sets,
  };
}

describe('определение рекордов', () => {
  it('находит новый максимальный вес', () => {
    const records = detectPersonalRecords(
      bench([set('a', 82.5, 8)]),
      { maxWeightKg: 80 },
      ctx,
    );
    const maxWeight = records.find((r) => r.kind === 'max_weight');
    expect(maxWeight?.value).toBe(82.5);
    expect(maxWeight?.previousValue).toBe(80);
  });

  it('не считает рекордом повторение прошлого результата', () => {
    const previous: PreviousBests = {
      maxWeightKg: 82.5,
      est1rmKg: 104.5,
      setVolumeKg: 660,
      sessionVolumeKg: 1897.5,
      repMaxKg: { 1: 82.5, 3: 82.5, 5: 82.5, 8: 82.5 },
    };
    const records = detectPersonalRecords(bench([set('a', 82.5, 8)]), previous, ctx);
    expect(records.filter((r) => r.kind === 'max_weight')).toHaveLength(0);
    expect(records.filter((r) => r.kind === 'rep_max')).toHaveLength(0);
  });

  it('ведёт рекорды на разное число повторов', () => {
    const records = detectPersonalRecords(bench([set('a', 100, 5)]), {}, ctx);
    const repMaxes = records.filter((r) => r.kind === 'rep_max');
    expect(repMaxes.map((r) => r.repTarget).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 3, 5]);
    expect(repMaxes.every((r) => r.value === 100)).toBe(true);
  });

  it('игнорирует разминочные и невыполненные подходы', () => {
    const records = detectPersonalRecords(
      bench([
        set('a', 120, 5, { setType: 'warmup' }),
        set('b', 130, 5, { isCompleted: false }),
        set('c', 80, 5),
      ]),
      { maxWeightKg: 100 },
      ctx,
    );
    expect(records.filter((r) => r.kind === 'max_weight')).toHaveLength(0);
  });

  it('находит рекорд объёма подхода', () => {
    const records = detectPersonalRecords(bench([set('a', 80, 10)]), { maxWeightKg: 100 }, ctx);
    const setVolume = records.find((r) => r.kind === 'set_volume');
    expect(setVolume?.value).toBe(800);
  });

  it('не создаёт весовых рекордов для упражнений на время', () => {
    const plank: AnalyticsExercise = {
      id: 'we2', exerciseId: 'ex_plank', name: 'Планка', metricType: 'duration',
      primaryMuscle: 'abs',
      sets: [{
        id: 'a', setType: 'working', isCompleted: true, weightKg: null, reps: null,
        durationSec: 90, distanceM: null, assistKg: null, addedWeightKg: null, rir: null, rpe: null,
      }],
    };
    expect(detectPersonalRecords(plank, {}, ctx)).toHaveLength(0);
  });

  it('не считает рекорды для упражнения без exerciseId', () => {
    const orphan = { ...bench([set('a', 200, 5)]), exerciseId: null };
    expect(detectPersonalRecords(orphan, {}, ctx)).toHaveLength(0);
  });
});
