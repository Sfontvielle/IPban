import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { TemplateRepository } from '@/repositories/TemplateRepository';
import { usePalette } from '@/theme/ThemeProvider';

/** Создаёт пустой шаблон и сразу открывает редактор — на один экран меньше. */
export default function NewTemplateRoute() {
  const router = useRouter();
  const palette = usePalette();

  useEffect(() => {
    (async () => {
      const id = await TemplateRepository.create({ name: 'Новая тренировка' });
      router.replace(`/template/${id}/edit?isNew=1`);
    })();
  }, [router]);

  return (
    <View style={[styles.center, { backgroundColor: palette.ground }]}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
