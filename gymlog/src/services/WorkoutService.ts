import {
  calculateSessionTotals,
  calculateSetVolume,
  detectPersonalRecords,
  estimateOneRepMax,
  effectiveLoadKg,
  isCountedSet,
  supportsOneRepMax,
  type AnalyticsExercise,
  type AnalyticsSet,
  type DetectedRecord,
  type VolumeContext,
} from '@/analytics';
import { BodyWeightRepository } from '@/repositories/BodyWeightRepository';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { TemplateRepository } from '@/repositories/TemplateRepository';
import { WorkoutRepository } from '@/repositories/WorkoutRepository';
import type { PersonalRecord, SessionWithContents, WorkoutExerciseWithSets, WorkoutSet } from '@/types/domain';

/** Приведение записей из базы к форме, понятной аналитике. */
export function toAnalyticsSet(set: WorkoutSet): AnalyticsSet {
  return {
    id: set.id,
    setType: set.setType,
    isCompleted: set.isCompleted,
    weightKg: set.weightKg,
    reps: set.reps,
    durationSec: set.durationSec,
    distanceM: set.distanceM,
    assistKg: set.assistKg,
    addedWeightKg: set.addedWeightKg,
    rir: set.rir,
    rpe: set.rpe,
  };
}

export function toAnalyticsExercise(exercise: WorkoutExerciseWithSets): AnalyticsExercise {
  return {
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    name: exercise.exerciseName,
    metricType: exercise.metricType,
    primaryMuscle: exercise.primaryMuscle,
    sets: exercise.sets.map(toAnalyticsSet),
  };
}

export interface WorkoutSummary {
  session: SessionWithContents;
  records: PersonalRecord[];
  volumeKg: number;
  workingSets: number;
  totalReps: number;
  exercises: number;
  durationSec: number;
}

export const WorkoutService = {
  /** Единственная активная тренировка; если её нет — null. */
  async getActive() {
    return WorkoutRepository.getActiveSession();
  },

  async startEmpty(title = 'Тренировка'): Promise<string> {
    const active = await WorkoutRepository.getActiveSession();
    if (active) return active.id;
    const bodyWeightKg = await BodyWeightRepository.weightAt(Date.now());
    return WorkoutRepository.createSession({ title, bodyWeightKg });
  },

  /**
   * Старт из шаблона: упражнения КОПИРУЮТСЯ в тренировку вместе со снимками полей.
   * Дальнейшая правка шаблона не изменит уже проведённую тренировку.
   */
  async startFromTemplate(templateId: string): Promise<string> {
    const active = await WorkoutRepository.getActiveSession();
    if (active) return active.id;

    const template = await TemplateRepository.getWithExercises(templateId);
    if (!template) throw new Error('Шаблон не найден');

    const bodyWeightKg = await BodyWeightRepository.weightAt(Date.now());
    const sessionId = await WorkoutRepository.createSession({
      title: template.name,
      templateId: template.id,
      templateName: template.name,
      bodyWeightKg,
    });

    for (const item of template.exercises) {
      const workoutExerciseId = await WorkoutRepository.addExercise(sessionId, {
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        metricType: item.metricType,
        equipment: item.equipment,
        primaryMuscle: item.primaryMuscle,
        restSec: item.restSec ?? template.defaultRestSec ?? null,
      });

      // Заранее создаём плановые подходы с весом прошлой тренировки — меньше нажатий в зале.
      const previous = await WorkoutRepository.getPreviousPerformance(item.exerciseId, Date.now());
      const plannedSets = item.targetSets ?? previous?.sets.length ?? 3;
      for (let i = 0; i < plannedSets; i += 1) {
        const previousSet = previous?.sets[i];
        await WorkoutRepository.addSet(workoutExerciseId, {
          weightKg: previousSet?.weightKg ?? null,
          reps: previousSet?.reps ?? item.targetRepsMin ?? null,
        });
      }
    }

    await TemplateRepository.markUsed(templateId);
    return sessionId;
  },

  async addExercises(sessionId: string, exerciseIds: string[]): Promise<void> {
    const items = await ExerciseRepository.listByIds(exerciseIds);
    for (const item of items) {
      const workoutExerciseId = await WorkoutRepository.addExercise(sessionId, {
        exerciseId: item.id,
        exerciseName: item.nameRu,
        metricType: item.metricType,
        equipment: item.equipment,
        primaryMuscle: item.primaryMuscle,
      });
      const previous = await WorkoutRepository.getPreviousPerformance(item.id, Date.now());
      const count = previous?.sets.length ?? 3;
      for (let i = 0; i < count; i += 1) {
        await WorkoutRepository.addSet(workoutExerciseId, {
          weightKg: previous?.sets[i]?.weightKg ?? null,
          reps: previous?.sets[i]?.reps ?? null,
        });
      }
    }
  },

  async replaceExercise(workoutExerciseId: string, newExerciseId: string): Promise<void> {
    const [item] = await ExerciseRepository.listByIds([newExerciseId]);
    if (!item) throw new Error('Упражнение не найдено');
    await WorkoutRepository.replaceExercise(workoutExerciseId, {
      exerciseId: item.id,
      exerciseName: item.nameRu,
      metricType: item.metricType,
      equipment: item.equipment,
      primaryMuscle: item.primaryMuscle,
    });
    const previous = await WorkoutRepository.getPreviousPerformance(item.id, Date.now());
    const count = previous?.sets.length ?? 3;
    for (let i = 0; i < count; i += 1) {
      await WorkoutRepository.addSet(workoutExerciseId, {
        weightKg: previous?.sets[i]?.weightKg ?? null,
        reps: previous?.sets[i]?.reps ?? null,
      });
    }
  },

  /**
   * Пересчёт производных полей подхода. Вызывается при каждом изменении,
   * чтобы SUM() по базе всегда был корректным и быстрым.
   */
  computeSetDerived(
    set: AnalyticsSet,
    exercise: { metricType: WorkoutExerciseWithSets['metricType'] },
    ctx: VolumeContext,
  ): { volumeKg: number | null; est1rmKg: number | null } {
    const volumeKg = calculateSetVolume(set, exercise.metricType, ctx);
    let est1rmKg: number | null = null;
    if (isCountedSet(set) && supportsOneRepMax(exercise.metricType)) {
      const load = effectiveLoadKg(set, exercise.metricType, ctx);
      const reps = set.reps ?? 0;
      if (load && reps > 0) est1rmKg = estimateOneRepMax(load, reps);
    }
    return { volumeKg: volumeKg || null, est1rmKg };
  },

  async volumeContext(sessionId: string): Promise<VolumeContext> {
    const session = await WorkoutRepository.getSession(sessionId);
    if (session?.bodyWeightKg) return { bodyWeightKg: session.bodyWeightKg };
    const weight = await BodyWeightRepository.weightAt(session?.startedAt ?? Date.now());
    return { bodyWeightKg: weight };
  },

  /**
   * Завершение тренировки: считаем итоги, определяем рекорды, сохраняем всё одним сценарием.
   * Ни одно число здесь не приходит извне — только из analytics.
   */
  async finishSession(sessionId: string): Promise<WorkoutSummary> {
    const session = await WorkoutRepository.getSessionWithContents(sessionId);
    if (!session) throw new Error('Тренировка не найдена');

    const ctx = await this.volumeContext(sessionId);
    // Если тренировка уже была завершена и открыта для правки — сохраняем исходное время.
    const finishedAt = session.finishedAt ?? Date.now();
    const durationSec =
      session.durationSec ?? Math.max(1, Math.round((finishedAt - session.startedAt) / 1000));

    // Производные значения подходов — на случай, если что-то не пересчиталось по ходу.
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        const derived = this.computeSetDerived(toAnalyticsSet(set), exercise, ctx);
        if (derived.volumeKg !== set.volumeKg || derived.est1rmKg !== set.est1rmKg) {
          await WorkoutRepository.updateSet(set.id, derived);
          set.volumeKg = derived.volumeKg;
          set.est1rmKg = derived.est1rmKg;
        }
      }
    }

    const analyticsExercises = session.exercises.map(toAnalyticsExercise);
    const totals = calculateSessionTotals(analyticsExercises, ctx, durationSec);

    // Старые рекорды этой сессии удаляем — на случай повторного завершения после правки.
    await PersonalRecordRepository.deleteBySession(sessionId);

    const allRecords: DetectedRecord[] = [];
    for (const exercise of analyticsExercises) {
      if (!exercise.exerciseId) continue;
      const previousBests = await PersonalRecordRepository.getPreviousBests(
        exercise.exerciseId,
        session.startedAt,
      );
      allRecords.push(...detectPersonalRecords(exercise, previousBests, ctx));
    }
    await PersonalRecordRepository.insertMany(allRecords, sessionId, finishedAt);

    await WorkoutRepository.finishSession(sessionId, {
      finishedAt,
      durationSec,
      volumeKg: totals.volumeKg,
      sets: totals.workingSets,
      reps: totals.totalReps,
      exercises: totals.exercises,
      prCount: allRecords.length,
    });

    const saved = await WorkoutRepository.getSessionWithContents(sessionId);
    const records = await PersonalRecordRepository.listBySession(sessionId);

    return {
      session: saved as SessionWithContents,
      records,
      volumeKg: totals.volumeKg,
      workingSets: totals.workingSets,
      totalReps: totals.totalReps,
      exercises: totals.exercises,
      durationSec,
    };
  },

  /** Пересчёт завершённой тренировки после ручной правки истории. */
  async recalculateSession(sessionId: string): Promise<void> {
    const session = await WorkoutRepository.getSessionWithContents(sessionId);
    if (!session) return;
    const ctx = await this.volumeContext(sessionId);

    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        const derived = this.computeSetDerived(toAnalyticsSet(set), exercise, ctx);
        await WorkoutRepository.updateSet(set.id, derived);
      }
    }

    const analyticsExercises = session.exercises.map(toAnalyticsExercise);
    const totals = calculateSessionTotals(analyticsExercises, ctx, session.durationSec);

    await PersonalRecordRepository.deleteBySession(sessionId);
    const records: DetectedRecord[] = [];
    for (const exercise of analyticsExercises) {
      if (!exercise.exerciseId) continue;
      const previousBests = await PersonalRecordRepository.getPreviousBests(exercise.exerciseId, session.startedAt);
      records.push(...detectPersonalRecords(exercise, previousBests, ctx));
    }
    await PersonalRecordRepository.insertMany(records, sessionId, session.finishedAt ?? session.startedAt);

    await WorkoutRepository.finishSession(sessionId, {
      finishedAt: session.finishedAt ?? Date.now(),
      durationSec: session.durationSec ?? 0,
      volumeKg: totals.volumeKg,
      sets: totals.workingSets,
      reps: totals.totalReps,
      exercises: totals.exercises,
      prCount: records.length,
    });
  },

  async getSummary(sessionId: string): Promise<WorkoutSummary | null> {
    const session = await WorkoutRepository.getSessionWithContents(sessionId);
    if (!session) return null;
    const records = await PersonalRecordRepository.listBySession(sessionId);
    return {
      session,
      records,
      volumeKg: session.totalVolumeKg ?? 0,
      workingSets: session.totalSets ?? 0,
      totalReps: session.totalReps ?? 0,
      exercises: session.totalExercises ?? 0,
      durationSec: session.durationSec ?? 0,
    };
  },

  async discard(sessionId: string): Promise<void> {
    await WorkoutRepository.discardSession(sessionId);
  },

  /** Создание шаблона из проведённой тренировки. */
  async saveAsTemplate(sessionId: string, name: string): Promise<string> {
    const session = await WorkoutRepository.getSessionWithContents(sessionId);
    if (!session) throw new Error('Тренировка не найдена');
    const templateId = await TemplateRepository.create({ name });
    for (const exercise of session.exercises) {
      if (!exercise.exerciseId) continue;
      await TemplateRepository.addExercise(templateId, exercise.exerciseId, {
        targetSets: exercise.sets.filter((s) => s.isCompleted).length || exercise.sets.length,
        restSec: exercise.restSec,
      });
    }
    return templateId;
  },
};
