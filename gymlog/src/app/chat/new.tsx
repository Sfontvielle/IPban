import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AIChatService } from '@/ai/AIChatService';
import { usePalette } from '@/theme/ThemeProvider';
import type { AiChat } from '@/types/domain';

/** Создаёт беседу нужного типа и открывает её. */
export default function NewChatRoute() {
  const router = useRouter();
  const palette = usePalette();
  const { scope, refId, q } = useLocalSearchParams<{ scope?: string; refId?: string; q?: string }>();

  useEffect(() => {
    (async () => {
      const chatScope = (scope === 'exercise' || scope === 'session' ? scope : 'general') as AiChat['scope'];
      const chatId = await AIChatService.ensureChat(chatScope, refId ?? null);
      router.replace(`/chat/${chatId}${q ? `?q=${encodeURIComponent(String(q))}` : ''}`);
    })();
  }, [scope, refId, q, router]);

  return (
    <View style={[styles.center, { backgroundColor: palette.ground }]}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
