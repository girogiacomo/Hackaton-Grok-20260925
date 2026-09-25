import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('sidequest', {
    name: 'Sidequest',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
  channelReady = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Remote push token. Returns null on simulators, in Expo Go on Android
 * (remote push is unsupported there since SDK 53) or when permission is denied.
 * The app still works via the WebSocket and local notifications.
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (!(await requestNotificationPermission())) return null;
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}

/** Immediate local notification, used when the WS delivers an event while backgrounded. */
export async function notifyLocal(title: string, body: string): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  } catch {
    // Notifications are best effort.
  }
}
