import type { AIToolDefinition } from '@/ai/provider/AIProvider';

const period = {
  type: 'string',
  description: 'Период: 7d, 30d, 90d, 180d, 365d или all. По умолчанию 90d.',
};

/**
 * Инструменты — это узкие срезы вашей базы, а не выгрузка всей истории.
 * Все они только читают данные: изменить что-либо модель не может.
 */
export const TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: 'find_exercises',
    description:
      'Найти упражнения по названию или мышце и получить их идентификаторы. ' +
      'Вызывай это первым, если вопрос про конкретное упражнение.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Название или часть названия упражнения' },
        limit: { type: 'number', description: 'Сколько вернуть, по умолчанию 8' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_training_summary',
    description: 'Сводка за период: число тренировок, объём, подходы, повторы, частота.',
    input_schema: { type: 'object', properties: { period } },
  },
  {
    name: 'get_recent_sessions',
    description: 'Список последних тренировок: дата, название, длительность, объём, число рекордов.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'По умолчанию 5' } },
    },
  },
  {
    name: 'get_session_details',
    description: 'Подробности одной тренировки: упражнения, подходы, веса, повторы, RIR/RPE.',
    input_schema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'compare_sessions',
    description: 'Сравнить две тренировки: приложение возвращает готовые дельты и проценты.',
    input_schema: {
      type: 'object',
      properties: { sessionIdA: { type: 'string' }, sessionIdB: { type: 'string' } },
      required: ['sessionIdA', 'sessionIdB'],
    },
  },
  {
    name: 'get_exercise_history',
    description: 'История выполнения упражнения: даты и подходы.',
    input_schema: {
      type: 'object',
      properties: {
        exerciseId: { type: 'string' },
        limit: { type: 'number', description: 'Сколько последних выполнений, по умолчанию 8' },
      },
      required: ['exerciseId'],
    },
  },
  {
    name: 'get_exercise_progress',
    description:
      'Прогресс по упражнению за период: рабочий вес, расчётный 1ПМ, объём, ' +
      'изменения в процентах — всё посчитано приложением.',
    input_schema: {
      type: 'object',
      properties: { exerciseId: { type: 'string' }, period },
      required: ['exerciseId'],
    },
  },
  {
    name: 'get_personal_records',
    description: 'Личные рекорды за период (или по конкретному упражнению).',
    input_schema: {
      type: 'object',
      properties: { period, exerciseId: { type: 'string' } },
    },
  },
  {
    name: 'get_volume_by_muscle',
    description: 'Объём и количество рабочих подходов по группам мышц за период.',
    input_schema: { type: 'object', properties: { period } },
  },
  {
    name: 'get_weekly_volume',
    description: 'Объём и число тренировок по неделям.',
    input_schema: {
      type: 'object',
      properties: { weeks: { type: 'number', description: 'Сколько недель, по умолчанию 8' } },
    },
  },
  {
    name: 'get_stalled_exercises',
    description:
      'Упражнения без прогресса. Застой определяется алгоритмом приложения, а не оценкой на глаз.',
    input_schema: {
      type: 'object',
      properties: { minSessions: { type: 'number', description: 'Минимум выполнений, по умолчанию 4' } },
    },
  },
  {
    name: 'get_untrained_muscles',
    description: 'Какие группы мышц давно не нагружались и сколько дней назад это было.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_body_weight_trend',
    description: 'История веса тела за период и изменение за этот период.',
    input_schema: { type: 'object', properties: { period } },
  },
  {
    name: 'get_exercise_reference',
    description: 'Справка каталога по упражнению: мышцы, оборудование, техника, ошибки, советы.',
    input_schema: {
      type: 'object',
      properties: { exerciseId: { type: 'string' } },
      required: ['exerciseId'],
    },
  },
  {
    name: 'suggest_substitutes',
    description:
      'Список замен для упражнения. Подбирается алгоритмом приложения по семейству, ' +
      'паттерну движения и мышцам.',
    input_schema: {
      type: 'object',
      properties: { exerciseId: { type: 'string' } },
      required: ['exerciseId'],
    },
  },
  {
    name: 'get_user_memory',
    description: 'Сохранённые пользователем факты о себе: предпочтения, ограничения, оборудование.',
    input_schema: { type: 'object', properties: {} },
  },
];
