import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui/Txt';
import { DatabaseProvider, useDatabaseStatus } from '@/db/provider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

function AppStack() {
  const { palette, isDark } = useTheme();
  const status = useDatabaseStatus();

  if (!status.ready) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.ground }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {status.error ? (
          <>
            <Txt variant="title" tone="crit">Не удалось открыть базу</Txt>
            <Txt variant="small" tone="muted" align="center">{status.error}</Txt>
          </>
        ) : (
          <>
            <ActivityIndicator color={palette.accent} />
            <Txt variant="small" tone="muted">GymLog · {status.stage}</Txt>
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.ground },
          headerTintColor: palette.accentInk,
          headerTitleStyle: { color: palette.ink, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.ground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/active"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="workout/start" options={{ title: 'Новая тренировка', presentation: 'modal' }} />
        <Stack.Screen
          name="workout/summary/[sessionId]"
          options={{ title: 'Итоги', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="exercise/picker" options={{ title: 'Выбор упражнений', presentation: 'modal' }} />
        <Stack.Screen name="exercise/new" options={{ title: 'Своё упражнение', presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]/index" options={{ title: 'Упражнение' }} />
        <Stack.Screen name="exercise/[id]/substitutes" options={{ title: 'Замена' }} />
        <Stack.Screen name="template/new" options={{ title: 'Новая тренировка', presentation: 'modal' }} />
        <Stack.Screen name="template/[id]/index" options={{ title: 'Тренировка' }} />
        <Stack.Screen name="template/[id]/edit" options={{ title: 'Редактирование' }} />
        <Stack.Screen name="history/[sessionId]" options={{ title: 'Тренировка' }} />
        <Stack.Screen name="stats/[id]" options={{ title: 'Прогресс' }} />
        <Stack.Screen name="chat/[chatId]" options={{ title: 'AI Тренер' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Настройки', presentation: 'modal' }} />
        <Stack.Screen name="settings/ai-memory" options={{ title: 'Память AI' }} />
        <Stack.Screen name="settings/data" options={{ title: 'Данные' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <ThemeProvider>
            <AppStack />
          </ThemeProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
