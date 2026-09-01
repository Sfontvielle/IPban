import '@/utils/errorReporting';

import { trace } from '@/utils/trace';

trace('модуль _layout загружен');

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DIAGNOSTIC_MODE } from '@/config/startup';
import { Txt } from '@/components/ui/Txt';
import { DatabaseProvider, useDatabaseStatus } from '@/db/provider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

trace('импорты _layout выполнены');

function AppStack() {
  const { palette, isDark } = useTheme();
  const status = useDatabaseStatus();

  trace('AppStack рендер', { ready: status.ready, stage: status.stage });

  // В аварийном режиме 1 базы нет вообще — ждать её готовности бессмысленно.
  if (!status.ready && DIAGNOSTIC_MODE !== 1) {
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
            <Txt variant="h2">GymLog</Txt>
            <ActivityIndicator color={palette.accent} />
            <Txt variant="title" tone="accent" align="center">{status.stage}</Txt>
          </>
        )}
      </View>
    );
  }

  trace('монтирую Stack навигатора');

  /**
   * Настройки экранов намеренно сведены к минимуму.
   *
   * expo-router и так находит все маршруты по файлам — блоки <Stack.Screen>
   * нужны были только ради заголовков и модальных презентаций. Именно они
   * обращаются к нативной части react-native-screens, а её падение
   * закрывает приложение без единого сообщения. Вернём по одной,
   * когда станет ясно, что запуск стабилен.
   */
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: palette.ground } }}>
        {/* Единственное объявление: у вкладок свой заголовок, системный тут лишний.
            У остальных экранов остаётся стандартный заголовок — с ним работает
            кнопка «назад», и это самый обкатанный путь в react-native-screens. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

/** Уровень 2: голый экран без единого нашего провайдера. */
function MinimalScreen() {
  return (
    <View style={styles.minimal}>
      <Txt variant="h2" tone="inverse">GymLog</Txt>
      <Txt tone="inverse" align="center">
        Аварийный режим 2. Если этот экран виден — среда и React Native в порядке,
        дело в наших провайдерах или базе.
      </Txt>
    </View>
  );
}

export default function RootLayout() {
  trace('RootLayout рендер', { mode: DIAGNOSTIC_MODE });

  if (DIAGNOSTIC_MODE === 2) {
    return <MinimalScreen />;
  }

  // Уровень 1: интерфейс без базы данных.
  if (DIAGNOSTIC_MODE === 1) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppStack />
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DatabaseProvider>
          <ThemeProvider>
            <AppStack />
          </ThemeProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  minimal: {
    flex: 1,
    backgroundColor: '#0E1216',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
