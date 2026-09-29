import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Pairing {
  url: string;
  code: string;
}

const KEY = 'sidequest.pairing';
const CLIENT_KEY = 'waitflip.client';
const LOOK_KEY = 'waitflip.look';

export type Look = 'classic' | 'modern';

export async function loadLook(): Promise<Look> {
  try {
    const value = await AsyncStorage.getItem(LOOK_KEY);
    return value === 'modern' ? 'modern' : 'classic';
  } catch {
    return 'classic';
  }
}

export async function saveLook(look: Look): Promise<void> {
  await AsyncStorage.setItem(LOOK_KEY, look);
}

/** Stable id for this browser so two phones both count on the shared chart. */
export function getClientId(): string {
  try {
    const existing = globalThis.localStorage?.getItem(CLIENT_KEY);
    if (existing) return existing;
    const id = `wf-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    globalThis.localStorage?.setItem(CLIENT_KEY, id);
    return id;
  } catch {
    return 'device';
  }
}

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
