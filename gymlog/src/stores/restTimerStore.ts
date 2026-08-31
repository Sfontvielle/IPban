import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { currentSettings } from '@/stores/settingsStore';
import { cancelRestNotification, scheduleRestNotification } from '@/services/NotificationService';

interface RestTimerState {
  /** Момент окончания отдыха. Таймер живёт на метке времени, а не на счётчике —
   *  поэтому переживает сворачивание приложения. */
  endsAt: number | null;
  totalSec: number;
  label: string | null;
  start: (seconds: number, label?: string) => void;
  addTime: (seconds: number) => void;
  skip: () => void;
  remainingSec: () => number;
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  endsAt: null,
  totalSec: 0,
  label: null,

  start(seconds, label) {
    if (seconds <= 0) return;
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, totalSec: seconds, label: label ?? null });
    const settings = currentSettings();
    if (settings.restHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (settings.restNotification) {
      scheduleRestNotification(seconds, label ?? 'Отдых закончен');
    }
  },

  addTime(seconds) {
    const { endsAt, totalSec, label } = get();
    const base = endsAt && endsAt > Date.now() ? endsAt : Date.now();
    const nextEndsAt = base + seconds * 1000;
    set({ endsAt: nextEndsAt, totalSec: totalSec + seconds });
    const settings = currentSettings();
    if (settings.restNotification) {
      scheduleRestNotification(Math.round((nextEndsAt - Date.now()) / 1000), label ?? 'Отдых закончен');
    }
  },

  skip() {
    set({ endsAt: null, totalSec: 0, label: null });
    cancelRestNotification();
  },

  remainingSec() {
    const { endsAt } = get();
    if (!endsAt) return 0;
    return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  },
}));
