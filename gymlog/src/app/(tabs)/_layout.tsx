import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { usePalette } from '@/theme/ThemeProvider';
import { trace } from '@/utils/trace';

trace('модуль (tabs)/_layout загружен');

/**
 * Иконки — обычный react-native Text, а не наш Txt.
 * Панель вкладок рендерится навигатором в своём поддереве, и лишняя
 * зависимость от контекста темы здесь ничего не даёт, зато добавляет риск.
 */
function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const palette = usePalette();

  trace('TabsLayout рендер');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accentInk,
        tabBarInactiveTintColor: palette.inkFaint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Главная', tabBarIcon: ({ color }) => <TabIcon glyph="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: 'Тренировки', tabBarIcon: ({ color }) => <TabIcon glyph="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="exercises"
        options={{ title: 'Каталог', tabBarIcon: ({ color }) => <TabIcon glyph="🔍" color={color} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Прогресс', tabBarIcon: ({ color }) => <TabIcon glyph="📈" color={color} /> }}
      />
      <Tabs.Screen
        name="coach"
        options={{ title: 'AI Тренер', tabBarIcon: ({ color }) => <TabIcon glyph="🤖" color={color} /> }}
      />
    </Tabs>
  );
}
