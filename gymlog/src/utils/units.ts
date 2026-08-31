import type { WeightUnit } from '@/constants/enums';

const LB_PER_KG = 2.20462262185;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** В базе всегда килограммы; наружу отдаём в выбранных единицах. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** 82.5 → «82,5»; 80 → «80». */
export function formatDecimal(value: number, maxDigits = 2): string {
  const rounded = Math.round(value * 10 ** maxDigits) / 10 ** maxDigits;
  return String(rounded).replace('.', ',');
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined) return '—';
  return `${formatDecimal(fromKg(kg, unit), 2)} ${unit === 'kg' ? 'кг' : 'фнт'}`;
}

export function formatWeightValue(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined) return '—';
  return formatDecimal(fromKg(kg, unit), 2);
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'kg' ? 'кг' : 'фнт';
}
