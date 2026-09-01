import { Platform } from 'react-native';

/**
 * Локальные уведомления таймера отдыха.
 *
 * expo-notifications подключается ЛЕНИВО, через динамический import:
 * expo-router загружает все файлы маршрутов при старте, поэтому обычный импорт
 * затащил бы этот модуль в путь запуска приложения. В Expo Go он частично
 * не поддерживается (см. предупреждения в консоли), и ему там делать нечего,
 * пока пользователь не запустил таймер.
 */

type NotificationsModule = typeof import('expo-notifications');

let restNotificationId: string | null = null;
let configured = false;
let permissionGranted: boolean | null = null;
let modulePromise: Promise<NotificationsModule | null> | null = null;

async function loadModule(): Promise<NotificationsModule | null> {
  if (!modulePromise) {
    modulePromise = import('expo-notifications').catch((error) => {
      console.warn('[gymlog] expo-notifications недоступен', error);
      return null;
    });
  }
  return modulePromise;
}

async function ensureConfigured(Notifications: NotificationsModule): Promise<boolean> {
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

    const Notifications = await loadModule();
    if (!Notifications) return;
    if (!(await ensureConfigured(Notifications))) return;

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
    if (!restNotificationId) return;
    const Notifications = await loadModule();
    if (Notifications) {
      await Notifications.cancelScheduledNotificationAsync(restNotificationId);
    }
    restNotificationId = null;
  } catch {
    restNotificationId = null;
  }
}
