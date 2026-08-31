import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Txt } from '@/components/ui/Txt';
import type { Equipment, MuscleGroup } from '@/constants/enums';
import { ExerciseRow } from '@/features/catalog/components/ExerciseRow';
import { FilterBar } from '@/features/catalog/components/FilterBar';
import { SearchField } from '@/features/catalog/components/SearchField';
import { useDebounce } from '@/hooks/useDebounce';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { TemplateRepository } from '@/repositories/TemplateRepository';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { ExerciseListItem } from '@/types/domain';
import { plural } from '@/utils/date';

/**
 * Общий экран выбора упражнений: используется и для шаблона, и для активной тренировки,
 * и для замены упражнения. Режим задаётся параметрами маршрута.
 */
export function ExercisePickerScreen() {
  const router = useRouter();
  const palette = usePalette();
  const params = useLocalSearchParams<{
    target?: string;
    templateId?: string;
    replaceId?: string;
  }>();

  const [query, setQuery] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addExercises = useActiveWorkoutStore((s) => s.addExercises);
  const replaceExercise = useActiveWorkoutStore((s) => s.replaceExercise);
  const singleSelect = !!params.replaceId;
  const debouncedQuery = useDebounce(query);

  const runSearch = useCallback(async () => {
    const results = await ExerciseRepository.search({
      query: debouncedQuery,
      muscles,
      equipment,
      limit: 60,
    });
    setItems(results);
  }, [debouncedQuery, muscles, equipment]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const toggleSelect = (id: string) => {
    if (singleSelect) {
      setSelected([id]);
      return;
    }
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const confirm = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      if (params.replaceId) {
        await replaceExercise(params.replaceId, selected[0]);
      } else if (params.target === 'template' && params.templateId) {
        for (const exerciseId of selected) {
          await TemplateRepository.addExercise(params.templateId, exerciseId);
        }
      } else {
        await addExercises(selected);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <View style={[styles.screen, { backgroundColor: palette.ground }]}>
      <View style={styles.search}>
        <SearchField value={query} onChange={setQuery} autoFocus />
      </View>

      <FilterBar
        muscles={muscles}
        equipment={equipment}
        onToggleMuscle={(muscle) => setMuscles((current) => toggle(current, muscle))}
        onToggleEquipment={(item) => setEquipment((current) => toggle(current, item))}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ExerciseRow
            item={item}
            selected={selected.includes(item.id)}
            onPress={() => toggleSelect(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🔎"
            title="Ничего не найдено"
            description="Измените запрос или создайте своё упражнение."
            actionTitle="Создать упражнение"
            onAction={() => router.push('/exercise/new')}
          />
        }
        ListFooterComponent={<View style={styles.footer} />}
      />

      <View style={[styles.bar, { backgroundColor: palette.ground, borderTopColor: palette.line }]}>
        <Txt variant="small" tone="muted">
          {selected.length > 0
            ? `Выбрано ${selected.length} ${plural(selected.length, 'упражнение', 'упражнения', 'упражнений')}`
            : 'Выберите упражнения'}
        </Txt>
        <Button
          title={params.replaceId ? 'Заменить' : 'Добавить'}
          onPress={confirm}
          disabled={selected.length === 0}
          loading={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  footer: { height: 100 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
