import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useRestTimerStore } from '@/stores/restTimerStore';
import { currentSettings } from '@/stores/settingsStore';

/**
 * Тикающий остаток времени. Значение всегда вычисляется от метки окончания,
 * поэтому после возврата из фона таймер показывает корректное время,
 * а не «замороженное» на моменте сворачивания.
 */
export function useRestTimer() {
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const totalSec = useRestTimerStore((s) => s.totalSec);
  const [remaining, setRemaining] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      firedRef.current = false;
      return;
    }

    firedRef.current = false;

    const update = () => {
      const value = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(value);
      if (value === 0 && !firedRef.current) {
        firedRef.current = true;
        if (currentSettings().restHaptics) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    };

    update();
    const interval = setInterval(update, 500);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [endsAt]);

  return {
    remaining,
    totalSec,
    isRunning: !!endsAt && remaining > 0,
    isFinished: !!endsAt && remaining === 0,
    progress: totalSec > 0 ? 1 - remaining / totalSec : 0,
  };
}
