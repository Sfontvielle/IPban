import { MUSCLE_LABELS, type MuscleGroup } from '@/constants/enums';
import { calculateExerciseProgress } from '@/analytics/progression';
import { PersonalRecordRepository } from '@/repositories/PersonalRecordRepository';
import { StatsRepository } from '@/repositories/StatsRepository';
import { daysSince, periodOfLastDays, plural } from '@/utils/date';
import { formatInt, formatPercent } from '@/utils/format';

export interface Insight {
  id: string;
  icon: string;
  text: string;
}

const WATCHED_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps'];

/**
 * Подсказки на главном экране. Считаются полностью локально, без сети и без AI —
 * это обычные вычисления по вашим данным. AI позже лишь переформулирует такие факты.
 */
export const InsightService = {
  async build(now = Date.now()): Promise<Insight[]> {
    const insights: Insight[] = [];

    const totalSessions = await StatsRepository.totalSessions();
    if (totalSessions === 0) {
      return [{
        id: 'welcome',
        icon: '👋',
        text: 'Проведите первую тренировку — и здесь появится анализ вашего прогресса.',
      }];
    }

    // 1. Новые рекорды за две недели
    const prCount = await PersonalRecordRepository.countSince(now - 14 * 24 * 3600 * 1000);
    if (prCount > 0) {
      insights.push({
        id: 'prs',
        icon: '🏆',
        text: `${prCount} ${plural(prCount, 'новый рекорд', 'новых рекорда', 'новых рекордов')} за последние две недели.`,
      });
    }

    // 2. Давно не тренированная группа мышц
    const lastTrained = await StatsRepository.lastTrainedByMuscle();
    let stalest: { muscle: MuscleGroup; days: number } | null = null;
    for (const muscle of WATCHED_MUSCLES) {
      const at = lastTrained[muscle];
      if (!at) continue;
      const days = daysSince(at, now);
      if (days >= 7 && (!stalest || days > stalest.days)) stalest = { muscle, days };
    }
    if (stalest) {
      insights.push({
        id: 'stale-muscle',
        icon: '⏳',
        text: `${MUSCLE_LABELS[stalest.muscle]}: последняя нагрузка ${stalest.days} ${plural(stalest.days, 'день', 'дня', 'дней')} назад.`,
      });
    }

    // 3. Рост расчётного 1ПМ в самом частом упражнении
    const frequent = await StatsRepository.frequentExercises(3, 3);
    for (const exercise of frequent) {
      const period = periodOfLastDays(60, now);
      const points = (await StatsRepository.exerciseSessionPoints(exercise.exerciseId, 40)).filter(
        (point) => point.performedAt >= period.fromMs,
      );
      if (points.length < 3) continue;
      const progress = calculateExerciseProgress(points);
      if (progress.est1rmChangePct !== null && Math.abs(progress.est1rmChangePct) >= 1) {
        insights.push({
          id: `progress-${exercise.exerciseId}`,
          icon: progress.est1rmChangePct > 0 ? '📈' : '📉',
          text: `${exercise.name}: расчётный 1ПМ за 60 дней изменился на ${formatPercent(progress.est1rmChangePct)}.`,
        });
        break;
      }
    }

    // 4. Сравнение объёма недели с предыдущей
    const thisWeek = await StatsRepository.periodSummary(now - 7 * 24 * 3600 * 1000, now);
    const lastWeek = await StatsRepository.periodSummary(
      now - 14 * 24 * 3600 * 1000,
      now - 7 * 24 * 3600 * 1000,
    );
    if (thisWeek.volumeKg > 0 && lastWeek.volumeKg > 0) {
      const change = ((thisWeek.volumeKg - lastWeek.volumeKg) / lastWeek.volumeKg) * 100;
      insights.push({
        id: 'weekly-volume',
        icon: '⚖️',
        text: `Объём за 7 дней — ${formatInt(thisWeek.volumeKg)} кг, это ${formatPercent(change)} к предыдущей неделе.`,
      });
    }

    return insights.slice(0, 3);
  },
};
