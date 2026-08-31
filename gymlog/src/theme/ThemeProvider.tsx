import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';
import { darkPalette, lightPalette, type Palette } from '@/theme/tokens';

interface ThemeValue {
  palette: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ palette: darkPalette, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => s.settings.theme);

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
    return { isDark, palette: isDark ? darkPalette : lightPalette };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function usePalette(): Palette {
  return useContext(ThemeContext).palette;
}
