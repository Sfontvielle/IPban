import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { HIT_SIZE, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHTS: Record<Size, number> = { sm: 36, md: HIT_SIZE, lg: 54 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
}: Props) {
  const palette = usePalette();

  const background =
    variant === 'primary' ? palette.accent
    : variant === 'secondary' ? palette.surfaceAlt
    : variant === 'danger' ? palette.critSoft
    : 'transparent';

  const textTone =
    variant === 'primary' ? 'inverse'
    : variant === 'danger' ? 'crit'
    : variant === 'ghost' ? 'accent'
    : 'default';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: background,
          borderRadius: size === 'lg' ? radius.lg : radius.md,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : palette.ink} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Txt
            variant={size === 'lg' ? 'bodyLarge' : 'body'}
            weight="600"
            tone={textTone}
          >
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
