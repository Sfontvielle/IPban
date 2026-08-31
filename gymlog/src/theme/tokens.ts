/**
 * Дизайн-токены. Палитра построена от цветов олимпийских дисков:
 * синий 20 кг как акцент, зелёный / жёлтый / красный как смысловые цвета.
 */

export interface Palette {
  ground: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  crit: string;
  critSoft: string;
  overlay: string;
}

export const lightPalette: Palette = {
  ground: '#F2F3F5',
  surface: '#FFFFFF',
  surfaceAlt: '#E9ECEF',
  surfaceRaised: '#FFFFFF',
  ink: '#14181D',
  inkMuted: '#4A535E',
  inkFaint: '#8A94A0',
  line: '#DDE2E8',
  lineStrong: '#C2CAD3',
  accent: '#1D4F91',
  accentInk: '#1D4F91',
  accentSoft: '#E4EBF5',
  ok: '#2E7D52',
  okSoft: '#E3F1EA',
  warn: '#9C6F00',
  warnSoft: '#F7EDD5',
  crit: '#B3202F',
  critSoft: '#F8E4E6',
  overlay: 'rgba(20,24,29,0.35)',
};

export const darkPalette: Palette = {
  ground: '#0E1216',
  surface: '#161B21',
  surfaceAlt: '#1E252D',
  surfaceRaised: '#1E252D',
  ink: '#E7ECF2',
  inkMuted: '#9DAAB8',
  inkFaint: '#6E7A88',
  line: '#28313B',
  lineStrong: '#3A4653',
  accent: '#6FA8E8',
  accentInk: '#8FBEF2',
  accentSoft: '#152538',
  ok: '#5FBE8E',
  okSoft: '#12291F',
  warn: '#E0B44A',
  warnSoft: '#2A2313',
  crit: '#EE7A87',
  critSoft: '#2E1519',
  overlay: 'rgba(0,0,0,0.55)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  h2: 24,
  h1: 30,
  display: 40,
} as const;

/** Минимальная зона нажатия — важно, когда телефон в руке возле тренажёра. */
export const HIT_SIZE = 44;
