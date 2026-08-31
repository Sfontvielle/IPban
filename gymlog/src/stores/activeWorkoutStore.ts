import { create } from 'zustand';

import { WorkoutRepository, type SetPatch } from '@/repositories/WorkoutRepository';
import { WorkoutService, toAnalyticsSet } from '@/services/WorkoutService';
import type { PreviousPerformance, WorkoutExerciseWithSets, WorkoutSession } from '@/types/domain';
import type { VolumeContext } from '@/analytics/types';

interface ActiveWorkoutState {
  sessionId: string | null;
  session: WorkoutSession | null;
  exercises: WorkoutExerciseWithSets[];
  previous: Record<string, PreviousPerformance | null>;
  ctx: VolumeContext;
  loading: boolean;

  load: (sessionId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;

  addExercises: (exerciseIds: string[]) => Promise<void>;
  replaceExercise: (workoutExerciseId: string, exerciseId: string) => Promise<void>;
  removeExercise: (workoutExerciseId: string) => Promise<void>;
  moveExercise: (workoutExerciseId: string, direction: -1 | 1) => Promise<void>;
  setExerciseNotes: (workoutExerciseId: string, notes: string) => Promise<void>;

  addSet: (workoutExerciseId: string) => Promise<void>;
  patchSet: (setId: string, patch: SetPatch) => Promise<void>;
  toggleSetCompleted: (setId: string) => Promise<boolean>;
  removeSet: (setId: string) => Promise<void>;
}

/**
 * Зеркало активной тренировки в памяти. Источник правды — SQLite:
 * каждое изменение немедленно уходит в базу, а стор нужен только для быстрой отрисовки.
 */
export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  sessionId: null,
  session: null,
  exercises: [],
  previous: {},
  ctx: { bodyWeightKg: null },
  loading: false,

  async load(sessionId) {
    set({ loading: true, sessionId });
    const [session, ctx] = await Promise.all([
      WorkoutRepository.getSessionWithContents(sessionId),
      WorkoutService.volumeContext(sessionId),
    ]);
    if (!session) {
      set({ loading: false, sessionId: null, session: null, exercises: [] });
      return;
    }

    const previous: Record<string, PreviousPerformance | null> = {};
    await Promise.all(
      session.exercises.map(async (exercise) => {
        if (!exercise.exerciseId) return;
        previous[exercise.exerciseId] = await WorkoutRepository.getPreviousPerformance(
          exercise.exerciseId,
          session.startedAt,
          sessionId,
        );
      }),
    );

    set({
      loading: false,
      sessionId,
      session,
      exercises: session.exercises,
      previous,
      ctx,
    });
  },

  async refresh() {
    const { sessionId } = get();
    if (sessionId) await get().load(sessionId);
  },

  clear() {
    set({ sessionId: null, session: null, exercises: [], previous: {}, loading: false });
  },

  async addExercises(exerciseIds) {
    const { sessionId } = get();
    if (!sessionId) return;
    await WorkoutService.addExercises(sessionId, exerciseIds);
    await get().refresh();
  },

  async replaceExercise(workoutExerciseId, exerciseId) {
    await WorkoutService.replaceExercise(workoutExerciseId, exerciseId);
    await get().refresh();
  },

  async removeExercise(workoutExerciseId) {
    set({ exercises: get().exercises.filter((item) => item.id !== workoutExerciseId) });
    await WorkoutRepository.removeExercise(workoutExerciseId);
  },

  async moveExercise(workoutExerciseId, direction) {
    const { sessionId, exercises } = get();
    if (!sessionId) return;
    const index = exercises.findIndex((item) => item.id === workoutExerciseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= exercises.length) return;

    const next = [...exercises];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    set({ exercises: next.map((item, position) => ({ ...item, position })) });
    await WorkoutRepository.reorderExercises(sessionId, next.map((item) => item.id));
  },

  async setExerciseNotes(workoutExerciseId, notes) {
    set({
      exercises: get().exercises.map((item) =>
        item.id === workoutExerciseId ? { ...item, notes } : item,
      ),
    });
    await WorkoutRepository.updateExerciseNotes(workoutExerciseId, notes || null);
  },

  async addSet(workoutExerciseId) {
    const exercise = get().exercises.find((item) => item.id === workoutExerciseId);
    const lastSet = exercise?.sets[exercise.sets.length - 1];
    const created = await WorkoutRepository.addSet(workoutExerciseId, {
      weightKg: lastSet?.weightKg ?? null,
      reps: lastSet?.reps ?? null,
      setType: 'working',
    });
    set({
      exercises: get().exercises.map((item) =>
        item.id === workoutExerciseId ? { ...item, sets: [...item.sets, created] } : item,
      ),
    });
  },

  async patchSet(setId, patch) {
    // Сначала обновляем экран, потом пишем в базу — ввод не должен «залипать».
    set({
      exercises: get().exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((item) =>
          item.id === setId
            ? {
                ...item,
                ...(patch.weightKg !== undefined ? { weightKg: patch.weightKg } : {}),
                ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
                ...(patch.durationSec !== undefined ? { durationSec: patch.durationSec } : {}),
                ...(patch.distanceM !== undefined ? { distanceM: patch.distanceM } : {}),
                ...(patch.assistKg !== undefined ? { assistKg: patch.assistKg } : {}),
                ...(patch.addedWeightKg !== undefined ? { addedWeightKg: patch.addedWeightKg } : {}),
                ...(patch.rir !== undefined ? { rir: patch.rir } : {}),
                ...(patch.rpe !== undefined ? { rpe: patch.rpe } : {}),
                ...(patch.setType !== undefined ? { setType: patch.setType } : {}),
                ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
              }
            : item,
        ),
      })),
    });
    await WorkoutRepository.updateSet(setId, patch);
  },

  /** Возвращает true, если подход был отмечен выполненным (нужно запустить таймер). */
  async toggleSetCompleted(setId) {
    const { exercises, ctx } = get();
    let completed = false;

    const nextExercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((item) => {
        if (item.id !== setId) return item;
        completed = !item.isCompleted;
        const updated = { ...item, isCompleted: completed, completedAt: completed ? Date.now() : null };
        const derived = WorkoutService.computeSetDerived(toAnalyticsSet(updated), exercise, ctx);
        return { ...updated, volumeKg: derived.volumeKg, est1rmKg: derived.est1rmKg };
      }),
    }));

    set({ exercises: nextExercises });

    const updatedSet = nextExercises
      .flatMap((exercise) => exercise.sets)
      .find((item) => item.id === setId);

    await WorkoutRepository.updateSet(setId, {
      isCompleted: completed,
      volumeKg: updatedSet?.volumeKg ?? null,
      est1rmKg: updatedSet?.est1rmKg ?? null,
    });

    return completed;
  },

  async removeSet(setId) {
    set({
      exercises: get().exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets
          .filter((item) => item.id !== setId)
          .map((item, index) => ({ ...item, setIndex: index + 1 })),
      })),
    });
    await WorkoutRepository.deleteSet(setId);
  },
}));
