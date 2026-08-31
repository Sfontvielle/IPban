import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { ExerciseRow } from '@/features/catalog/components/ExerciseRow';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { spacing } from '@/theme/tokens';
import type { ExerciseDetail, ExerciseListItem } from '@/types/domain';

/**
 * Замена подбирается алгоритмом (семейство → паттерн → мышцы), а не языковой моделью.
 * AI может только объяснить разницу — но список всегда детерминированный.
 */
export function SubstitutesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [source, setSource] = useState<ExerciseDetail | null>(null);
  const [items, setItems] = useState<ExerciseListItem[]>([]);

  useEffect(() => {
    if (!id) return;
    ExerciseRepository.getById(id).then(setSource);
    ExerciseRepository.findSubstitutes(id, 12).then(setItems);
  }, [id]);

  return (
    <Screen scroll padded={false}>
      <View style={styles.head}>
        <Txt variant="label" tone="faint">Замена для</Txt>
        <Txt variant="title">{source?.nameRu ?? '…'}</Txt>
        <Card accent style={styles.note}>
          <Txt variant="small">
            Список подобран по семейству упражнения, паттерну движения и работающим мышцам.
            История результатов у каждого упражнения остаётся своей — статистика не смешивается.
          </Txt>
        </Card>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="🤷" title="Подходящих замен не нашлось" />
      ) : (
        items.map((item) => (
          <ExerciseRow key={item.id} item={item} onPress={() => router.push(`/exercise/${item.id}`)} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { padding: spacing.lg, gap: 4 },
  note: { marginTop: spacing.md },
});
