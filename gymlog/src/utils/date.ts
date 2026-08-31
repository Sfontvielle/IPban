import type { Period } from '@/types/domain';

export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Локальная дата в формате YYYY-MM-DD — используется для группировки по дням. */
export function toLocalDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  return startOfDay(ms) + DAY_MS - 1;
}

/** Начало недели. weekStartsOn: 1 = понедельник (по умолчанию). */
export function startOfWeek(ms: number, weekStartsOn = 1): number {
  const d = new Date(startOfDay(ms));
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return d.getTime() - diff * DAY_MS;
}

export function periodOfLastDays(days: number, now = Date.now()): Period {
  return { fromMs: startOfDay(now) - (days - 1) * DAY_MS, toMs: endOfDay(now) };
}

export function periodOfCurrentWeek(now = Date.now(), weekStartsOn = 1): Period {
  const from = startOfWeek(now, weekStartsOn);
  return { fromMs: from, toMs: from + 7 * DAY_MS - 1 };
}

export function daysBetween(aMs: number, bMs: number): number {
  return Math.round((startOfDay(bMs) - startOfDay(aMs)) / DAY_MS);
}

export function daysSince(ms: number, now = Date.now()): number {
  return daysBetween(ms, now);
}

/** «25 августа» или «25 августа 2025», если год не текущий. */
export function formatDateRu(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  return sameYear ? base : `${base} ${d.getFullYear()}`;
}

export function formatWeekdayShort(ms: number): string {
  return WEEKDAYS_SHORT[new Date(ms).getDay()];
}

export function formatTimeRu(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «Сегодня» / «Вчера» / «25 августа». */
export function formatDayLabel(ms: number, now = Date.now()): string {
  const diff = daysBetween(ms, now);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  if (diff === 2) return 'Позавчера';
  return formatDateRu(ms, now);
}

export function formatMonthTitle(ms: number): string {
  const MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  const d = new Date(ms);
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

/** 4320 → «1 ч 12 мин», 150 → «2 мин 30 с». */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
  return `${s} с`;
}

/** Формат таймера отдыха: 1:30. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad(s)}`;
}

/** Русское склонение: 1 тренировка, 2 тренировки, 5 тренировок. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
