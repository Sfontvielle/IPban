import { percentChange } from '@/analytics/progression';
import type { AnalyticsExercise, VolumeContext } from '@/analytics/types';
import { calculateExerciseVolume, calculateSessionTotals, isCountedSet } from '@/analytics/volume';
import { effectiveLoadKg } from '@/analytics/volume';

export interface ExerciseComparison {
  name: string;
  exerciseId: string | null;
  topSetWeightKg: number | null;
  previousTopSetWeightKg: number | null;
  weightDeltaKg: number | null;
  topSetReps: number | null;
  previousTopSetReps: number | null;
  volumeKg: number;
  previousVolumeKg: number | null;
  volumeChangePct: number | null;
  verdict: 'better' | 'same' | 'worse' | 'new';
}

export interface SessionComparison {
  volumeKg: number;
  previousVolumeKg: number;
  volumeChangePct: number | null;
  setsDelta: number;
  durationDeltaSec: number | null;
  exercises: ExerciseComparison[];
}

interface TopSet {
  weightKg: number | null;
  reps: number | null;
}

/** Лучший подход упражнения: сначала по весу, при равенстве — по повторам. */
export function findTopSet(exercise: AnalyticsExercise, ctx: VolumeContext): TopSet {
  let best: TopSet = { weightKg: null, reps: null };
  for (const set of exercise.sets) {
    if (!isCountedSet(set)) continue;
    const load = effectiveLoadKg(set, exercise.metricType, ctx);
    const reps = set.reps ?? 0;
    if (best.weightKg === null) {
      best = { weightKg: load, reps };
      continue;
    }
    if (load !== null && (load > best.weightKg || (load === best.weightKg && reps > (best.reps ?? 0)))) {
      best = { weightKg: load, reps };
    }
  }
  return best;
}

/** Сравнение двух тренировок. Все проценты считаются здесь, а не языковой моделью. */
export function compareSessions(
  current: { exercises: AnalyticsExercise[]; durationSec: number | null },
  previous: { exercises: AnalyticsExercise[]; durationSec: number | null },
  ctx: VolumeContext,
): SessionComparison {
  const currentTotals = calculateSessionTotals(current.exercises, ctx, current.durationSec);
  const previousTotals = calculateSessionTotals(previous.exercises, ctx, previous.durationSec);

  const previousByKey = new Map<string, AnalyticsExercise>();
  for (const exercise of previous.exercises) {
    previousByKey.set(exercise.exerciseId ?? exercise.name, exercise);
  }

  const exercises: ExerciseComparison[] = current.exercises.map((exercise) => {
    const key = exercise.exerciseId ?? exercise.name;
    const before = previousByKey.get(key);
    const volumeKg = calculateExerciseVolume(exercise, ctx);
    const top = findTopSet(exercise, ctx);

    if (!before) {
      return {
        name: exercise.name,
        exerciseId: exercise.exerciseId,
        topSetWeightKg: top.weightKg,
        previousTopSetWeightKg: null,
        weightDeltaKg: null,
        topSetReps: top.reps,
        previousTopSetReps: null,
        volumeKg,
        previousVolumeKg: null,
        volumeChangePct: null,
        verdict: 'new',
      };
    }

    const previousVolume = calculateExerciseVolume(before, ctx);
    const previousTop = findTopSet(before, ctx);
    const weightDelta =
      top.weightKg !== null && previousTop.weightKg !== null
        ? top.weightKg - previousTop.weightKg
        : null;
    const volumeChange = percentChange(previousVolume, volumeKg);

    let verdict: ExerciseComparison['verdict'] = 'same';
    if ((weightDelta ?? 0) > 0.01) verdict = 'better';
    else if ((weightDelta ?? 0) < -0.01) verdict = 'worse';
    else if (volumeChange !== null && volumeChange > 1) verdict = 'better';
    else if (volumeChange !== null && volumeChange < -1) verdict = 'worse';

    return {
      name: exercise.name,
      exerciseId: exercise.exerciseId,
      topSetWeightKg: top.weightKg,
      previousTopSetWeightKg: previousTop.weightKg,
      weightDeltaKg: weightDelta,
      topSetReps: top.reps,
      previousTopSetReps: previousTop.reps,
      volumeKg,
      previousVolumeKg: previousVolume,
      volumeChangePct: volumeChange,
      verdict,
    };
  });

  return {
    volumeKg: currentTotals.volumeKg,
    previousVolumeKg: previousTotals.volumeKg,
    volumeChangePct: percentChange(previousTotals.volumeKg, currentTotals.volumeKg),
    setsDelta: currentTotals.workingSets - previousTotals.workingSets,
    durationDeltaSec:
      current.durationSec !== null && previous.durationSec !== null
        ? current.durationSec - previous.durationSec
        : null,
    exercises,
  };
}
