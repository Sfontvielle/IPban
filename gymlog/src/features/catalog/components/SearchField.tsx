import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChange, placeholder = 'Поиск упражнений', autoFocus }: Props) {
  const palette = usePalette();

  return (
    <View style={[styles.wrapper, { backgroundColor: palette.surfaceAlt }]}>
      <Txt tone="faint">🔍</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.inkFaint}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={[styles.input, { color: palette.ink }]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Очистить">
          <Txt tone="faint" variant="title">✕</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
});
