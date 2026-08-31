import { compareSessions } from '@/analytics/comparison';
import { toAnalyticsExercise } from '@/services/WorkoutService';
import { MUSCLE_LABELS, type MuscleGroup } from '@/constants/enums';
import { MemoryRepository } from '@/repositories/ai/MemoryRepository';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { RecoveryRepository } from '@/repositories/RecoveryRepository';
import { StatsRepository } from '@/repositories/StatsRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService } from '@/services/WorkoutService';
import { toLocalDate } from '@/utils/date';

const MAX_CONTEXT_CHARS = 8000;
const MAX_SETS_PER_EXERCISE = 8;

function round(value: number | null | undefined, digits = 1): number | null {
  if (value === null || value === undefined) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Контекст для разбора тренировки: маленький JSON с УЖЕ ПОСЧИТАННЫМИ числами.
 * Модель получает готовые значения и только формулирует вывод.
 */
export async function buildWorkoutAnalysisContext(sessionId: string): Promise<string> {
  const session = await WorkoutRepository.getSessionWithContents(sessionId);
  if (!session) throw new Error('Тренировка не найдена');

  const ctx = await WorkoutService.volumeContext(sessionId);
  const previousSessions = await WorkoutRepository.listSessions(3);
  const previousSession = previousSessions.find((item) => item.id !== sessionId) ?? null;
  const previousContents = previousSession
    ? await WorkoutRepository.getSessionWithContents(previousSession.id)
    : null;

  const comparison = previousContents
    ? compareSessions(
        { exercises: session.exercises.map(toAnalyticsExercise), durationSec: session.durationSec },
        {
          exercises: previousContents.exercises.map(toAnalyticsExercise),
          durationSec: previousContents.durationSec,
        },
        ctx,
      )
    : null;

  const records = await PersonalRecordRepository.listBySession(sessionId);
  const recovery = await RecoveryRepository.getForSession(sessionId);
  const memory = await MemoryRepository.listEnabled();
  const lastTrained = await StatsRepository.lastTrainedByMuscle();

  const exercises = session.exercises
    .filter((exercise) => exercise.sets.some((set) => set.isCompleted))
    .map((exercise) => {
      const comparisonRow = comparison?.exercises.find((item) => item.name === exercise.exerciseName);
      const previousPerf = previousContents?.exercises.find(
        (item) => item.exerciseId === exercise.exerciseId,
      );

      return {
        name: exercise.exerciseName,
        metricType: exercise.metricType,
        muscle: exercise.primaryMuscle ? MUSCLE_LABELS[exercise.primaryMuscle as MuscleGroup] : null,
        today: exercise.sets
          .filter((set) => set.isCompleted)
          .slice(0, MAX_SETS_PER_EXERCISE)
          .map((set) => ({
            kg: round(set.weightKg, 2),
            reps: set.reps,
            sec: set.durationSec,
            rir: set.rir,
            rpe: set.rpe,
          })),
        previous: previousPerf
          ? previousPerf.sets
              .filter((set) => set.isCompleted)
              .slice(0, MAX_SETS_PER_EXERCISE)
              .map((set) => ({ kg: round(set.weightKg, 2), reps: set.reps, rir: set.rir }))
          : null,
        volumeKg: round(comparisonRow?.volumeKg ?? null, 0),
        previousVolumeKg: round(comparisonRow?.previousVolumeKg ?? null, 0),
        volumeChangePct: round(comparisonRow?.volumeChangePct ?? null, 1),
        topSetWeightChangeKg: round(comparisonRow?.weightDeltaKg ?? null, 2),
        verdict: comparisonRow?.verdict ?? null,
        newRecords: records
          .filter((record) => record.exerciseName === exercise.exerciseName)
          .map((record) => ({ kind: record.kind, reps: record.repTarget, value: round(record.value, 2) })),
      };
    });

  const staleMuscles = Object.entries(lastTrained)
    .map(([muscle, at]) => ({
      muscle: MUSCLE_LABELS[muscle as MuscleGroup] ?? muscle,
      daysAgo: Math.round((session.startedAt - at) / (24 * 3600 * 1000)),
    }))
    .filter((item) => item.daysAgo >= 7)
    .sort((a, b) => b.daysAgo - a.daysAgo)
    .slice(0, 3);

  const payload = {
    schema: 'workout_analysis.v1',
    units: { weight: 'kg', volume: 'kg' },
    computedBy: 'app',
    session: {
      date: toLocalDate(session.startedAt),
      title: session.title,
      durationMin: session.durationSec ? Math.round(session.durationSec / 60) : null,
      exercises: session.totalExercises,
      workingSets: session.totalSets,
      totalReps: session.totalReps,
      volumeKg: round(session.totalVolumeKg, 0),
      newRecords: records.length,
    },
    comparedTo: previousSession
      ? {
          date: toLocalDate(previousSession.startedAt),
          title: previousSession.title,
          volumeKg: round(previousSession.totalVolumeKg, 0),
          volumeChangePct: round(comparison?.volumeChangePct ?? null, 1),
          setsDelta: comparison?.setsDelta ?? null,
        }
      : null,
    exercises,
    recovery: recovery
      ? { mood: recovery.mood, sleep: recovery.sleep, energy: recovery.energy, note: recovery.note }
      : null,
    musclesNotTrainedRecently: staleMuscles,
    memory: memory.map((item) => item.text),
  };

  let json = JSON.stringify(payload);
  if (json.length > MAX_CONTEXT_CHARS) {
    // Бюджет контекста: сначала режем упражнения без изменений.
    payload.exercises = payload.exercises.filter(
      (exercise) => exercise.verdict !== 'same' || exercise.newRecords.length > 0,
    );
    json = JSON.stringify(payload);
  }
  if (json.length > MAX_CONTEXT_CHARS) {
    payload.exercises = payload.exercises.slice(0, 5);
    json = JSON.stringify(payload);
  }

  return json;
}
