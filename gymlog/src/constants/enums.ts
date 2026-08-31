/**
 * Доменные перечисления. Значения совпадают со строками в SQLite,
 * поэтому менять их можно только вместе с миграцией.
 */

export const METRIC_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_reps',
  'reps_only',
  'duration',
  'weight_duration',
  'distance_duration',
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  weight_reps: 'Вес × повторы',
  bodyweight_reps: 'Свой вес × повторы',
  weighted_bodyweight: 'Свой вес + доп. вес',
  assisted_reps: 'С помощью (гравитрон)',
  reps_only: 'Только повторы',
  duration: 'Время',
  weight_duration: 'Вес × время',
  distance_duration: 'Расстояние и время',
};

export const SET_TYPES = ['warmup', 'working', 'dropset', 'failure', 'backoff'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Разминочный',
  working: 'Рабочий',
  dropset: 'Дроп-сет',
  failure: 'До отказа',
  backoff: 'Откатный',
};

/** Подходы, которые участвуют в объёме, рекордах и статистике. */
export const COUNTED_SET_TYPES: readonly SetType[] = ['working', 'failure', 'backoff', 'dropset'];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'abs',
  'obliques',
  'neck',
  'full_body',
  'cardio',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  lats: 'Широчайшие',
  traps: 'Трапеции',
  lower_back: 'Поясница',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  forearms: 'Предплечья',
  quads: 'Квадрицепс',
  hamstrings: 'Бицепс бедра',
  glutes: 'Ягодицы',
  calves: 'Икры',
  adductors: 'Приводящие',
  abductors: 'Отводящие',
  abs: 'Пресс',
  obliques: 'Косые',
  neck: 'Шея',
  full_body: 'Всё тело',
  cardio: 'Кардио',
};

/** Крупные группы для сводки объёма — несколько мышц схлопываются в одну строку. */
export const MUSCLE_PARENT: Record<MuscleGroup, MuscleGroup> = {
  chest: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'biceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  adductors: 'quads',
  abductors: 'glutes',
  abs: 'abs',
  obliques: 'abs',
  neck: 'shoulders',
  full_body: 'full_body',
  cardio: 'cardio',
};

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'smith',
  'bodyweight',
  'band',
  'trx',
  'ez_bar',
  'plate',
  'medicine_ball',
  'box',
  'bench',
  'sled',
  'rope',
  'cardio_machine',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  kettlebell: 'Гиря',
  machine: 'Тренажёр',
  cable: 'Блок',
  smith: 'Смит',
  bodyweight: 'Свой вес',
  band: 'Резинка',
  trx: 'TRX',
  ez_bar: 'EZ-гриф',
  plate: 'Блин',
  medicine_ball: 'Мяч',
  box: 'Тумба',
  bench: 'Скамья',
  sled: 'Сани',
  rope: 'Канат',
  cardio_machine: 'Кардио-тренажёр',
  other: 'Другое',
};

export const CATEGORIES = [
  'bodybuilding',
  'powerlifting',
  'weightlifting',
  'calisthenics',
  'functional',
  'crossfit',
  'core',
  'cardio',
  'plyometrics',
  'mobility',
  'stretching',
  'balance',
  'rehab',
  'sport',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  bodybuilding: 'Бодибилдинг',
  powerlifting: 'Пауэрлифтинг',
  weightlifting: 'Тяжёлая атлетика',
  calisthenics: 'Калистеника',
  functional: 'Функциональный',
  crossfit: 'Кроссфит',
  core: 'Кор',
  cardio: 'Кардио',
  plyometrics: 'Плиометрика',
  mobility: 'Мобильность',
  stretching: 'Растяжка',
  balance: 'Баланс',
  rehab: 'Реабилитация',
  sport: 'Спортивная подготовка',
};

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'rotation',
  'isolation',
  'gait',
  'jump',
  'static',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MOVEMENT_LABELS: Record<MovementPattern, string> = {
  horizontal_push: 'Горизонтальный жим',
  vertical_push: 'Вертикальный жим',
  horizontal_pull: 'Горизонтальная тяга',
  vertical_pull: 'Вертикальная тяга',
  squat: 'Присед',
  hinge: 'Наклон / шарнир',
  lunge: 'Выпад',
  carry: 'Перенос',
  rotation: 'Ротация',
  isolation: 'Изоляция',
  gait: 'Ходьба / бег',
  jump: 'Прыжок',
  static: 'Статика',
};

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export type PushPull = 'push' | 'pull' | 'static' | 'none';
export type Laterality = 'bilateral' | 'unilateral' | 'alternating';

export const PR_KINDS = ['max_weight', 'rep_max', 'est_1rm', 'set_volume', 'session_volume'] as const;
export type PrKind = (typeof PR_KINDS)[number];

export const PR_KIND_LABELS: Record<PrKind, string> = {
  max_weight: 'Максимальный вес',
  rep_max: 'Рекорд на повторы',
  est_1rm: 'Расчётный 1ПМ',
  set_volume: 'Объём подхода',
  session_volume: 'Объём за тренировку',
};

/** Для каких чисел повторов ведём отдельные рекорды. */
export const REP_MAX_TARGETS = [1, 3, 5, 8, 10, 12] as const;

export type IntensityMode = 'off' | 'rir' | 'rpe';
export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'system' | 'light' | 'dark';
