import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MuscleGlyph } from '@/components/ui/MuscleGlyph';
import { Txt } from '@/components/ui/Txt';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/constants/enums';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { ExerciseListItem } from '@/types/domain';

interface Props {
  item: ExerciseListItem;
  onPress: () => void;
  selected?: boolean;
  right?: React.ReactNode;
}

export const ExerciseRow = React.memo(function ExerciseRow({ item, onPress, selected, right }: Props) {
  const palette = usePalette();

  const subtitle = [
    item.primaryMuscle ? MUSCLE_LABELS[item.primaryMuscle] : null,
    item.equipment ? EQUIPMENT_LABELS[item.equipment] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: palette.line,
          backgroundColor: selected ? palette.accentSoft : pressed ? palette.surfaceAlt : 'transparent',
        },
      ]}
    >
      <MuscleGlyph muscle={item.primaryMuscle} />
      <View style={styles.text}>
        <Txt variant="body" weight="500" numberOfLines={1}>{item.nameRu}</Txt>
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
          {item.isCustom ? ' · своё' : ''}
        </Txt>
      </View>
      {right ?? (selected ? <Txt tone="accent" variant="title">✓</Txt> : <Txt tone="faint">›</Txt>)}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 62,
  },
  text: { flex: 1, gap: 2 },
});
