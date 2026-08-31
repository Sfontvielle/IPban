import type { MetricType, SetType } from '@/constants/enums';

/** Минимальная форма подхода, которой достаточно всем расчётам. */
export interface AnalyticsSet {
  id: string;
  setType: SetType;
  isCompleted: boolean;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  assistKg: number | null;
  addedWeightKg: number | null;
  rir: number | null;
  rpe: number | null;
}

export interface AnalyticsExercise {
  id: string;
  exerciseId: string | null;
  name: string;
  metricType: MetricType;
  primaryMuscle: string | null;
  sets: AnalyticsSet[];
}

export interface VolumeContext {
  /** Вес тела на дату тренировки; нужен для упражнений со своим весом. */
  bodyWeightKg: number | null;
}

export interface SessionTotals {
  volumeKg: number;
  workingSets: number;
  totalReps: number;
  exercises: number;
  durationSec: number | null;
}
