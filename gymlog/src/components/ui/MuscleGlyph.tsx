import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { MuscleGroup } from '@/constants/enums';
import { MUSCLE_PARENT } from '@/constants/enums';
import { usePalette } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/**
 * Заглушка изображения упражнения: собственная векторная иконка по группе мышц.
 * Никаких сторонних картинок — приложение полностью рабочее и без медиа,
 * а слой exercise_media готов принять лицензированные изображения позже.
 */

interface Props {
  muscle: MuscleGroup | null;
  size?: number;
}

const ACCENTS: Partial<Record<MuscleGroup, string>> = {
  chest: '#D1495B',
  back: '#1D4F91',
  shoulders: '#E09F3E',
  biceps: '#7B61A8',
  triceps: '#8A5A44',
  quads: '#2E7D52',
  hamstrings: '#3E8E7E',
  glutes: '#C05780',
  calves: '#5C7A99',
  abs: '#B08900',
  full_body: '#4A6572',
  cardio: '#C1554A',
};

function Glyph({ muscle, color }: { muscle: MuscleGroup | null; color: string }) {
  switch (muscle) {
    case 'chest':
      return (
        <>
          <Path d="M8 10c3-2 7-2 8 1 1-3 5-3 8-1 1 4-2 8-8 9-6-1-9-5-8-9z" fill={color} opacity={0.9} />
        </>
      );
    case 'back':
    case 'lats':
      return <Path d="M16 5l7 5-2 12h-10l-2-12z" fill={color} opacity={0.9} />;
    case 'shoulders':
      return (
        <>
          <Circle cx="9" cy="13" r="5" fill={color} opacity={0.9} />
          <Circle cx="23" cy="13" r="5" fill={color} opacity={0.6} />
        </>
      );
    case 'biceps':
      return <Path d="M9 20c0-7 4-11 9-11 4 0 6 3 5 6-1 4-6 4-8 8-2 3-6 2-6-3z" fill={color} opacity={0.9} />;
    case 'triceps':
      return <Path d="M22 20c0-7-4-11-9-11-4 0-6 3-5 6 1 4 6 4 8 8 2 3 6 2 6-3z" fill={color} opacity={0.9} />;
    case 'quads':
      return (
        <>
          <Rect x="9" y="6" width="5" height="18" rx="2.5" fill={color} opacity={0.9} />
          <Rect x="17" y="6" width="5" height="18" rx="2.5" fill={color} opacity={0.6} />
        </>
      );
    case 'hamstrings':
    case 'glutes':
      return (
        <>
          <Circle cx="12" cy="12" r="6" fill={color} opacity={0.85} />
          <Circle cx="20" cy="12" r="6" fill={color} opacity={0.6} />
          <Rect x="9" y="17" width="14" height="7" rx="3" fill={color} opacity={0.5} />
        </>
      );
    case 'calves':
      return <Path d="M12 4h8v12c0 6-2 10-4 10s-4-4-4-10z" fill={color} opacity={0.85} />;
    case 'abs':
      return (
        <>
          <Rect x="10" y="6" width="5" height="6" rx="1.5" fill={color} opacity={0.9} />
          <Rect x="17" y="6" width="5" height="6" rx="1.5" fill={color} opacity={0.9} />
          <Rect x="10" y="14" width="5" height="6" rx="1.5" fill={color} opacity={0.7} />
          <Rect x="17" y="14" width="5" height="6" rx="1.5" fill={color} opacity={0.7} />
        </>
      );
    case 'cardio':
      return <Path d="M4 17h6l3-7 4 12 3-8h8" stroke={color} strokeWidth={2.5} fill="none" />;
    default:
      return (
        <>
          <Rect x="4" y="13" width="4" height="6" rx="1.5" fill={color} opacity={0.9} />
          <Rect x="24" y="13" width="4" height="6" rx="1.5" fill={color} opacity={0.9} />
          <Rect x="9" y="14.5" width="14" height="3" rx="1.5" fill={color} opacity={0.7} />
        </>
      );
  }
}

export function MuscleGlyph({ muscle, size = 44 }: Props) {
  const palette = usePalette();
  const parent = muscle ? MUSCLE_PARENT[muscle] : null;
  const color = (parent && ACCENTS[parent]) || palette.accent;

  return (
    <View
      style={[
        styles.wrapper,
        { width: size, height: size, backgroundColor: palette.surfaceAlt, borderColor: palette.line },
      ]}
    >
      <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32">
        <Glyph muscle={parent} color={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
});
