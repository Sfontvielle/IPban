import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  const palette = usePalette();
  return (
    <>
      <Stack.Screen options={{ title: 'Не найдено' }} />
      <View style={[styles.center, { backgroundColor: palette.ground }]}>
        <Txt variant="title">Такого экрана нет</Txt>
        <Link href="/">
          <Txt tone="accent" weight="600">На главную</Txt>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
