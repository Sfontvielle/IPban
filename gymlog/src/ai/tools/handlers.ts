import { calculateExerciseProgress } from '@/analytics/progression';
import { bucketByWeek, calculateTrainingFrequency } from '@/analytics/frequency';
import { detectPlateau } from '@/analytics/plateau';
import { compareSessions } from '@/analytics/comparison';
import { MUSCLE_LABELS, type MuscleGroup } from '@/constants/enums';
import { BodyWeightRepository } from '@/repositories/BodyWeightRepository';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { MemoryRepository } from '@/repositories/ai/MemoryRepository';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { StatsRepository } from '@/repositories/StatsRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import { WorkoutService, toAnalyticsExercise } from '@/services/WorkoutService';
import type { Period } from '@/types/domain';
import { daysSince, periodOfLastDays, toLocalDate } from '@/utils/date';

function round(value: number | null | undefined, digits = 1): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parsePeriod(raw: unknown, now = Date.now()): Period {
  const value = typeof raw === 'string' ? raw.trim() : '90d';
  if (value === 'all') return { fromMs: 0, toMs: now };
  const match = /^(\d+)d$/.exec(value);
  const days = match ? Number(match[1]) : 90;
  return periodOfLastDays(days, now);
}

function str(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value) throw new Error(`Не передан параметр ${key}`);
  return value;
}

function int(input: Record<string, unknown>, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

/**
 * Исполнение инструментов. Каждый ответ содержит единицы измерения и период,
 * чтобы модель ничего не додумывала. Всё считается кодом, а не языковой моделью.
 */
export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const now = Date.now();

  switch (name) {
    case 'find_exercises': {
      const items = await ExerciseRepository.search({
        query: str(input, 'query'),
        limit: int(input, 'limit', 8),
      });
      return {
        units: null,
        exercises: items.map((item) => ({
          exerciseId: item.id,
          name: item.nameRu,
          nameEn: item.nameEn,
          muscle: item.primaryMuscle ? MUSCLE_LABELS[item.primaryMuscle] : null,
        })),
      };
    }

    case 'get_training_summary': {
      const period = parsePeriod(input.period, now);
      const summary = await StatsRepository.periodSummary(period.fromMs, period.toMs);
      const timestamps = (await StatsRepository.sessionTimestamps(period.fromMs, period.toMs)).map((i) => i.at);
      const frequency = calculateTrainingFrequency(timestamps, period, now);
      return {
        computedBy: 'app',
        units: { weight: 'kg', volume: 'kg', duration: 'sec' },
        period: { from: toLocalDate(period.fromMs), to: toLocalDate(period.toMs) },
        sessions: summary.sessions,
        volumeKg: round(summary.volumeKg, 0),
        workingSets: summary.sets,
        totalReps: summary.reps,
        totalDurationSec: summary.durationSec,
        sessionsPerWeek: round(frequency.perWeek, 2),
        averageGapDays: round(frequency.averageGapDays, 1),
        daysSinceLast: frequency.daysSinceLast,
      };
    }

    case 'get_recent_sessions': {
      const sessions = await WorkoutRepository.listSessions(int(input, 'limit', 5));
      return {
        computedBy: 'app',
        units: { volume: 'kg' },
        sessions: sessions.map((session) => ({
          sessionId: session.id,
          date: session.localDate,
          title: session.title,
          durationMin: session.durationSec ? Math.round(session.durationSec / 60) : null,
          volumeKg: round(session.totalVolumeKg, 0),
          workingSets: session.totalSets,
          exercises: session.totalExercises,
          newRecords: session.prCount,
        })),
      };
    }

    case 'get_session_details': {
      const session = await WorkoutRepository.getSessionWithContents(str(input, 'sessionId'));
      if (!session) return { error: 'Тренировка не найдена' };
      return {
        computedBy: 'app',
        units: { weight: 'kg' },
        date: session.localDate,
        title: session.title,
        durationMin: session.durationSec ? Math.round(session.durationSec / 60) : null,
        volumeKg: round(session.totalVolumeKg, 0),
        exercises: session.exercises.map((exercise) => ({
          name: exercise.exerciseName,
          sets: exercise.sets
            .filter((set) => set.isCompleted)
            .map((set) => ({
              kg: round(set.weightKg, 2),
              reps: set.reps,
              sec: set.durationSec,
              rir: set.rir,
              rpe: set.rpe,
            })),
        })),
      };
    }

    case 'compare_sessions': {
      const [a, b] = await Promise.all([
        WorkoutRepository.getSessionWithContents(str(input, 'sessionIdA')),
        WorkoutRepository.getSessionWithContents(str(input, 'sessionIdB')),
      ]);
      if (!a || !b) return { error: 'Одна из тренировок не найдена' };
      const ctx = await WorkoutService.volumeContext(a.id);
      const result = compareSessions(
        { exercises: a.exercises.map(toAnalyticsExercise), durationSec: a.durationSec },
        { exercises: b.exercises.map(toAnalyticsExercise), durationSec: b.durationSec },
        ctx,
      );
      return {
        computedBy: 'app',
        units: { weight: 'kg', volume: 'kg' },
        a: { date: a.localDate, title: a.title },
        b: { date: b.localDate, title: b.title },
        volumeKg: round(result.volumeKg, 0),
        previousVolumeKg: round(result.previousVolumeKg, 0),
        volumeChangePct: round(result.volumeChangePct, 1),
        setsDelta: result.setsDelta,
        exercises: result.exercises.map((exercise) => ({
          name: exercise.name,
          topSetKg: round(exercise.topSetWeightKg, 2),
          previousTopSetKg: round(exercise.previousTopSetWeightKg, 2),
          weightDeltaKg: round(exercise.weightDeltaKg, 2),
          volumeChangePct: round(exercise.volumeChangePct, 1),
          verdict: exercise.verdict,
        })),
      };
    }

    case 'get_exercise_history': {
      const exerciseId = str(input, 'exerciseId');
      const history = await WorkoutRepository.getExerciseHistory(exerciseId, int(input, 'limit', 8));
      return {
        computedBy: 'app',
        units: { weight: 'kg' },
        exerciseId,
        performances: history.map((entry) => ({
          date: toLocalDate(entry.performedAt),
          sets: entry.sets.map((set) => ({
            kg: round(set.weightKg, 2),
            reps: set.reps,
            sec: set.durationSec,
            rir: set.rir,
            rpe: set.rpe,
          })),
        })),
      };
    }

    case 'get_exercise_progress': {
      const exerciseId = str(input, 'exerciseId');
      const period = parsePeriod(input.period, now);
      const allPoints = await StatsRepository.exerciseSessionPoints(exerciseId, 60);
      const points = allPoints.filter((point) => point.performedAt >= period.fromMs);
      const progress = calculateExerciseProgress(points);
      const plateau = detectPlateau(points, now);
      return {
        computedBy: 'app',
        units: { weight: 'kg', volume: 'kg' },
        exerciseId,
        period: { from: toLocalDate(period.fromMs), to: toLocalDate(period.toMs) },
        sessions: progress.sessionCount,
        bestWeightKg: round(progress.bestWeightKg, 2),
        bestEstimated1rmKg: round(progress.bestEst1rmKg, 1),
        totalVolumeKg: round(progress.totalVolumeKg, 0),
        weightChangePct: round(progress.weightChangePct, 1),
        estimated1rmChangePct: round(progress.est1rmChangePct, 1),
        volumeChangePct: round(progress.volumeChangePct, 1),
        plateau: { isPlateau: plateau.isPlateau, daysSinceBest: plateau.daysSinceBest },
        series: points.slice(-10).map((point) => ({
          date: point.localDate,
          maxWeightKg: round(point.maxWeightKg, 2),
          estimated1rmKg: round(point.bestEst1rmKg, 1),
          volumeKg: round(point.totalVolumeKg, 0),
        })),
      };
    }

    case 'get_personal_records': {
      const period = parsePeriod(input.period, now);
      const records = typeof input.exerciseId === 'string' && input.exerciseId
        ? await PersonalRecordRepository.listByExercise(input.exerciseId, 30)
        : await PersonalRecordRepository.listSince(period.fromMs, 40);
      return {
        computedBy: 'app',
        units: { weight: 'kg' },
        records: records.map((record) => ({
          date: record.localDate,
          exercise: record.exerciseName,
          kind: record.kind,
          reps: record.repTarget,
          valueKg: round(record.value, 2),
          previousValueKg: round(record.previousValue, 2),
        })),
      };
    }

    case 'get_volume_by_muscle': {
      const period = parsePeriod(input.period, now);
      const rows = await StatsRepository.muscleVolume(period.fromMs, period.toMs);
      return {
        computedBy: 'app',
        units: { volume: 'kg' },
        period: { from: toLocalDate(period.fromMs), to: toLocalDate(period.toMs) },
        muscles: rows.map((row) => ({
          muscle: MUSCLE_LABELS[row.muscle as MuscleGroup] ?? row.muscle,
          volumeKg: round(row.volumeKg, 0),
          workingSets: row.sets,
        })),
      };
    }

    case 'get_weekly_volume': {
      const weeks = int(input, 'weeks', 8);
      const from = now - weeks * 7 * 24 * 3600 * 1000;
      const items = await StatsRepository.sessionTimestamps(from, now);
      const buckets = bucketByWeek(items, weeks, now);
      return {
        computedBy: 'app',
        units: { volume: 'kg' },
        weeks: buckets.map((bucket) => ({
          weekStart: bucket.label,
          sessions: bucket.sessions,
          volumeKg: round(bucket.volumeKg, 0),
        })),
      };
    }

    case 'get_stalled_exercises': {
      const minSessions = int(input, 'minSessions', 4);
      const frequent = await StatsRepository.frequentExercises(minSessions, 12);
      const stalled: unknown[] = [];
      for (const exercise of frequent) {
        const points = await StatsRepository.exerciseSessionPoints(exercise.exerciseId, 20);
        const plateau = detectPlateau(points, now);
        if (plateau.isPlateau) {
          stalled.push({
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            sessionsAnalyzed: plateau.sessionsAnalyzed,
            estimated1rmChangePct: round(plateau.est1rmChangePct, 1),
            volumeChangePct: round(plateau.volumeChangePct, 1),
            daysSinceBest: plateau.daysSinceBest,
          });
        }
      }
      return { computedBy: 'app', units: { weight: 'kg' }, stalled };
    }

    case 'get_untrained_muscles': {
      const lastTrained = await StatsRepository.lastTrainedByMuscle();
      return {
        computedBy: 'app',
        muscles: Object.entries(lastTrained)
          .map(([muscle, at]) => ({
            muscle: MUSCLE_LABELS[muscle as MuscleGroup] ?? muscle,
            lastTrained: toLocalDate(at),
            daysAgo: daysSince(at, now),
          }))
          .sort((a, b) => b.daysAgo - a.daysAgo),
      };
    }

    case 'get_body_weight_trend': {
      const period = parsePeriod(input.period, now);
      const entries = (await BodyWeightRepository.list(200)).filter(
        (entry) => entry.measuredAt >= period.fromMs,
      );
      const sorted = [...entries].sort((a, b) => a.measuredAt - b.measuredAt);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        computedBy: 'app',
        units: { weight: 'kg' },
        entries: sorted.map((entry) => ({ date: entry.localDate, kg: round(entry.weightKg, 1) })),
        changeKg: first && last ? round(last.weightKg - first.weightKg, 1) : null,
      };
    }

    case 'get_exercise_reference': {
      const exercise = await ExerciseRepository.getById(str(input, 'exerciseId'));
      if (!exercise) return { error: 'Упражнение не найдено' };
      return {
        name: exercise.nameRu,
        nameEn: exercise.nameEn,
        primaryMuscles: exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]),
        secondaryMuscles: exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]),
        equipment: exercise.equipment,
        isCompound: exercise.isCompound,
        metricType: exercise.metricType,
        instructions: exercise.instructions.map((item) => ({ kind: item.kind, text: item.text })),
      };
    }

    case 'suggest_substitutes': {
      const exerciseId = str(input, 'exerciseId');
      const items = await ExerciseRepository.findSubstitutes(exerciseId, 8);
      return {
        computedBy: 'app',
        substitutes: items.map((item) => ({
          exerciseId: item.id,
          name: item.nameRu,
          muscle: item.primaryMuscle ? MUSCLE_LABELS[item.primaryMuscle] : null,
          equipment: item.equipment,
        })),
      };
    }

    case 'get_user_memory': {
      const memory = await MemoryRepository.listEnabled();
      return { facts: memory.map((item) => item.text) };
    }

    default:
      return { error: `Неизвестный инструмент: ${name}` };
  }
}
