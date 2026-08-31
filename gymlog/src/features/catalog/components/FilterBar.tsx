import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type Equipment,
  type MuscleGroup,
} from '@/constants/enums';
import { spacing } from '@/theme/tokens';

interface Props {
  muscles: MuscleGroup[];
  equipment: Equipment[];
  onToggleMuscle: (muscle: MuscleGroup) => void;
  onToggleEquipment: (equipment: Equipment) => void;
}

const QUICK_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs', 'calves',
];
const QUICK_EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'smith', 'kettlebell', 'band',
];

export function FilterBar({ muscles, equipment, onToggleMuscle, onToggleEquipment }: Props) {
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {QUICK_MUSCLES.filter((m) => MUSCLE_GROUPS.includes(m)).map((muscle) => (
          <Chip
            key={muscle}
            label={MUSCLE_LABELS[muscle]}
            selected={muscles.includes(muscle)}
            onPress={() => onToggleMuscle(muscle)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {QUICK_EQUIPMENT.filter((e) => EQUIPMENT.includes(e)).map((item) => (
          <Chip
            key={item}
            label={EQUIPMENT_LABELS[item]}
            selected={equipment.includes(item)}
            onPress={() => onToggleEquipment(item)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
