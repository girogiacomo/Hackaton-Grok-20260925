import type { Store } from './db.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Sends notifications to every paired device through Expo's push service. */
export class PushSender {
  constructor(
    private readonly store: Store,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly log: (msg: string) => void = () => undefined,
  ) {}

  async send(message: PushMessage): Promise<void> {
    const tokens = this.store.devices();
    if (tokens.length === 0) return;
    const payload = tokens.map((to) => ({
      to,
      sound: 'default',
      priority: 'high',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));
    try {
      const res = await this.fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.log(`push: Expo responded ${res.status}`);
        return;
      }
      const body = (await res.json()) as { data?: ExpoTicket[] };
      body.data?.forEach((ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          this.store.removeDevice(tokens[i]);
          this.log(`push: dropped unregistered device ${tokens[i]}`);
        }
      });
    } catch (err) {
      this.log(`push: failed ${(err as Error).message}`);
    }
  }
}

export function isExpoPushToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)
  );
}
