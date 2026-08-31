import { useFocusEffect, useRouter } from 'expo-router';
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
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import type { ExerciseListItem } from '@/types/domain';

const PAGE_SIZE = 40;

export function CatalogScreen() {
  const router = useRouter();
  const palette = usePalette();

  const [query, setQuery] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [recent, setRecent] = useState<ExerciseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const debouncedQuery = useDebounce(query);
  const hasFilters = muscles.length > 0 || equipment.length > 0 || debouncedQuery.trim().length > 0;

  const runSearch = useCallback(
    async (offset = 0) => {
      const results = await ExerciseRepository.search({
        query: debouncedQuery,
        muscles,
        equipment,
        limit: PAGE_SIZE,
        offset,
      });
      setCanLoadMore(results.length === PAGE_SIZE);
      setItems((current) => (offset === 0 ? results : [...current, ...results]));
      setLoading(false);
    },
    [debouncedQuery, muscles, equipment],
  );

  useEffect(() => {
    setLoading(true);
    runSearch(0);
  }, [runSearch]);

  useFocusEffect(
    useCallback(() => {
      ExerciseRepository.listRecentlyUsed(8).then(setRecent);
      ExerciseRepository.countAll().then(setTotal);
    }, []),
  );

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <View style={[styles.screen, { backgroundColor: palette.ground }]}>
      <View style={styles.search}>
        <SearchField value={query} onChange={setQuery} />
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
        renderItem={({ item }) => (
          <ExerciseRow item={item} onPress={() => router.push(`/exercise/${item.id}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (canLoadMore && !loading) runSearch(items.length);
        }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          !hasFilters && recent.length > 0 ? (
            <View>
              <Txt variant="label" tone="faint" style={styles.sectionTitle}>Недавние</Txt>
              {recent.map((item) => (
                <ExerciseRow
                  key={`recent-${item.id}`}
                  item={item}
                  onPress={() => router.push(`/exercise/${item.id}`)}
                />
              ))}
              <Txt variant="label" tone="faint" style={styles.sectionTitle}>
                Весь каталог · {total}
              </Txt>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="🔎"
              title="Ничего не найдено"
              description="Попробуйте другой запрос или создайте своё упражнение."
              actionTitle="Создать упражнение"
              onAction={() => router.push('/exercise/new')}
            />
          )
        }
        ListFooterComponent={<View style={styles.footer} />}
      />

      <View style={[styles.fab, { backgroundColor: palette.ground, borderTopColor: palette.line }]}>
        <Button
          title="Своё упражнение"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/exercise/new')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  footer: { height: 90 },
  fab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
