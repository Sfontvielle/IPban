import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { usePalette } from '@/theme/ThemeProvider';
import { fontSize } from '@/theme/tokens';

type Variant = 'display' | 'h1' | 'h2' | 'title' | 'body' | 'bodyLarge' | 'small' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'ok' | 'warn' | 'crit' | 'inverse';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700';
  align?: TextStyle['textAlign'];
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
}

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: fontSize.display, fontWeight: '700', letterSpacing: -0.8 },
  h1: { fontSize: fontSize.h1, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: fontSize.h2, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: fontSize.title, fontWeight: '600', letterSpacing: -0.2 },
  bodyLarge: { fontSize: fontSize.bodyLarge, fontWeight: '400' },
  body: { fontSize: fontSize.body, fontWeight: '400' },
  small: { fontSize: fontSize.small, fontWeight: '400' },
  caption: { fontSize: fontSize.caption, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
};

export function Txt({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  tabular,
  style,
  ...rest
}: Props) {
  const palette = usePalette();

  const color =
    tone === 'muted' ? palette.inkMuted
    : tone === 'faint' ? palette.inkFaint
    : tone === 'accent' ? palette.accentInk
    : tone === 'ok' ? palette.ok
    : tone === 'warn' ? palette.warn
    : tone === 'crit' ? palette.crit
    : tone === 'inverse' ? '#FFFFFF'
    : palette.ink;

  return (
    <Text
      {...rest}
      style={[
        VARIANTS[variant],
        { color },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
