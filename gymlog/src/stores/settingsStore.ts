import { create } from 'zustand';

import type { IntensityMode, ThemeMode, WeightUnit } from '@/constants/enums';
import { SettingsRepository } from '@/repositories/SettingsRepository';

export interface AppSettings {
  theme: ThemeMode;
  unit: WeightUnit;
  /** Шаг изменения веса кнопками «+»/«−». */
  weightStep: number;
  intensityMode: IntensityMode;
  autoRestTimer: boolean;
  defaultRestSec: number;
  restHaptics: boolean;
  restNotification: boolean;
  weekStartsOn: number;
  aiEnabled: boolean;
  aiProxyUrl: string;
  aiModelHint: string;
  aiWorkoutHints: boolean;
  aiAutoAnalysis: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  unit: 'kg',
  weightStep: 2.5,
  intensityMode: 'rir',
  autoRestTimer: true,
  defaultRestSec: 120,
  restHaptics: true,
  restNotification: true,
  weekStartsOn: 1,
  aiEnabled: false,
  aiProxyUrl: '',
  aiModelHint: '',
  aiWorkoutHints: true,
  aiAutoAnalysis: true,
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    const stored = await SettingsRepository.load<AppSettings>();
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true });
  },

  async update(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await SettingsRepository.save(next);
  },
}));

/** Синхронный доступ к настройкам вне React — для сервисов и AI. */
export function currentSettings(): AppSettings {
  return useSettingsStore.getState().settings;
}
