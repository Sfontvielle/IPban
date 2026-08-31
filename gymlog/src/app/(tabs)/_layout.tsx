import { Tabs } from 'expo-router';
import React from 'react';

import type { ColorValue } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Txt style={{ fontSize: 20, color }}>{glyph}</Txt>;
}

export default function TabsLayout() {
  const palette = usePalette();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accentInk,
        tabBarInactiveTintColor: palette.inkFaint,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: palette.ground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => <TabIcon glyph="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Тренировки',
          tabBarIcon: ({ color }) => <TabIcon glyph="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Каталог',
          tabBarIcon: ({ color }) => <TabIcon glyph="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Прогресс',
          tabBarIcon: ({ color }) => <TabIcon glyph="📈" color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'AI Тренер',
          tabBarIcon: ({ color }) => <TabIcon glyph="🤖" color={color} />,
        }}
      />
    </Tabs>
  );
}
