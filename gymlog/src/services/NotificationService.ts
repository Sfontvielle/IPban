import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Локальные уведомления таймера отдыха.
 * Работают в Expo Go на iOS; всё обёрнуто в try/catch — приложение не должно
 * падать из-за уведомлений, это вспомогательная функция.
 */

let restNotificationId: string | null = null;
let configured = false;
let permissionGranted: boolean | null = null;

async function ensureConfigured(): Promise<boolean> {
  if (!configured) {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: false,
        }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rest-timer', {
          name: 'Таймер отдыха',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
      configured = true;
    } catch {
      return false;
    }
  }

  if (permissionGranted === null) {
    try {
      const current = await Notifications.getPermissionsAsync();
      permissionGranted = current.granted;
      if (!permissionGranted) {
        const asked = await Notifications.requestPermissionsAsync();
        permissionGranted = asked.granted;
      }
    } catch {
      permissionGranted = false;
    }
  }

  return permissionGranted === true;
}

export async function scheduleRestNotification(seconds: number, title: string): Promise<void> {
  if (seconds <= 0) return;
  try {
    await cancelRestNotification();
    if (!(await ensureConfigured())) return;
    restNotificationId = await Notifications.scheduleNotificationAsync({
      content: { title, body: 'Пора делать следующий подход', sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: 'rest-timer',
      },
    });
  } catch {
    // Уведомления недоступны — таймер всё равно работает внутри приложения.
  }
}

export async function cancelRestNotification(): Promise<void> {
  try {
    if (restNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(restNotificationId);
      restNotificationId = null;
    }
  } catch {
    restNotificationId = null;
  }
}
