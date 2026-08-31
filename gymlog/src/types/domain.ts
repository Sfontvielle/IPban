import type {
  Category,
  Difficulty,
  Equipment,
  Laterality,
  MetricType,
  MovementPattern,
  MuscleGroup,
  PrKind,
  PushPull,
  SetType,
} from '@/constants/enums';

export interface Exercise {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string | null;
  familyId: string | null;
  category: Category;
  movementPattern: MovementPattern | null;
  metricType: MetricType;
  difficulty: Difficulty | null;
  isCompound: boolean;
  pushPull: PushPull | null;
  laterality: Laterality | null;
  defaultRestSec: number | null;
  popularity: number;
  isCustom: boolean;
  source: string;
  imageUri: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ExerciseListItem {
  id: string;
  nameRu: string;
  nameEn: string | null;
  metricType: MetricType;
  primaryMuscle: MuscleGroup | null;
  equipment: Equipment | null;
  isCustom: boolean;
  imageUri: string | null;
}

export interface ExerciseDetail extends Exercise {
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  aliases: string[];
  tags: string[];
  instructions: ExerciseInstruction[];
}

export interface ExerciseInstruction {
  id: string;
  kind: 'overview' | 'step' | 'mistake' | 'tip';
  position: number;
  text: string;
}

export interface TemplateFolder {
  id: string;
  name: string;
  position: number;
}

export interface WorkoutTemplate {
  id: string;
  folderId: string | null;
  name: string;
  notes: string | null;
  isFavorite: boolean;
  position: number;
  defaultRestSec: number | null;
  lastUsedAt: number | null;
  useCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  position: number;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  restSec: number | null;
  notes: string | null;
  /** Снимок из каталога — для отрисовки списка без второго запроса. */
  exerciseName: string;
  metricType: MetricType;
  primaryMuscle: MuscleGroup | null;
  equipment: Equipment | null;
}

export type SessionStatus = 'active' | 'completed' | 'discarded';

export interface WorkoutSession {
  id: string;
  templateId: string | null;
  templateNameSnapshot: string | null;
  title: string;
  status: SessionStatus;
  startedAt: number;
  finishedAt: number | null;
  durationSec: number | null;
  localDate: string;
  notes: string | null;
  totalVolumeKg: number | null;
  totalSets: number | null;
  totalReps: number | null;
  totalExercises: number | null;
  prCount: number | null;
  bodyWeightKg: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutExercise {
  id: string;
  sessionId: string;
  exerciseId: string | null;
  exerciseName: string;
  metricType: MetricType;
  equipment: Equipment | null;
  primaryMuscle: MuscleGroup | null;
  position: number;
  restSec: number | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  setIndex: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  assistKg: number | null;
  addedWeightKg: number | null;
  rir: number | null;
  rpe: number | null;
  isCompleted: boolean;
  completedAt: number | null;
  volumeKg: number | null;
  est1rmKg: number | null;
  isPr: boolean;
  notes: string | null;
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface SessionWithContents extends WorkoutSession {
  exercises: WorkoutExerciseWithSets[];
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  kind: PrKind;
  repTarget: number | null;
  value: number;
  unit: string;
  previousValue: number | null;
  sessionId: string | null;
  workoutSetId: string | null;
  achievedAt: number;
  localDate: string;
}

export interface BodyWeightEntry {
  id: string;
  measuredAt: number;
  localDate: string;
  weightKg: number;
  note: string | null;
}

export interface RecoveryCheckin {
  id: string;
  sessionId: string | null;
  localDate: string;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  motivation: number | null;
  note: string | null;
  createdAt: number;
}

/** Прошлое выполнение упражнения — то, что показывается в активной тренировке. */
export interface PreviousPerformance {
  sessionId: string;
  performedAt: number;
  sets: {
    setIndex: number;
    setType: SetType;
    weightKg: number | null;
    reps: number | null;
    durationSec: number | null;
    rir: number | null;
    rpe: number | null;
  }[];
}

export interface Period {
  fromMs: number;
  toMs: number;
}

export interface AiChat {
  id: string;
  title: string | null;
  scope: 'general' | 'exercise' | 'session';
  refId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AiMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolName: string | null;
  toolPayloadJson: string | null;
  status: 'pending' | 'done' | 'error';
  createdAt: number;
}

export interface AiMemoryItem {
  id: string;
  text: string;
  category: string | null;
  origin: 'user' | 'suggested';
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}
