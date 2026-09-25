import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Pairing {
  url: string;
  code: string;
}

const KEY = 'sidequest.pairing';

export async function loadPairing(): Promise<Pairing | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Pairing>;
    if (typeof parsed.url === 'string' && typeof parsed.code === 'string') {
      return { url: parsed.url, code: parsed.code };
    }
    return null;
  } catch {
    return null;
  }
}

export async function savePairing(p: Pairing): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export async function clearPairing(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Normalises user input like "192.168.1.5:4747" into a full http URL. */
export function normaliseUrl(input: string): string {
  let url = input.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export function wsUrl(pairing: Pairing): string {
  return `${pairing.url.replace(/^http/i, 'ws')}/ws?code=${encodeURIComponent(pairing.code)}`;
}
