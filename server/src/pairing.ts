import { networkInterfaces } from 'node:os';
import { randomInt, timingSafeEqual } from 'node:crypto';

/** Payload encoded in the pairing QR code and typed manually as a fallback. */
export interface PairingInfo {
  url: string;
  code: string;
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function codesMatch(expected: string, given: unknown): boolean {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** First non-internal IPv4 address, so the phone on the same Wi-Fi can reach us. */
export function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return undefined;
}

export function publicBaseUrl(port: number): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  return `http://${lanAddress() ?? '127.0.0.1'}:${port}`;
}

export function pairingQrText(info: PairingInfo): string {
  return JSON.stringify(info);
}

export function pairingPageHtml(info: PairingInfo, svg: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sidequest pairing</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1115; color: #e6e6e6; font: 16px/1.5 system-ui, sans-serif; }
  main { text-align: center; padding: 2rem; }
  h1 { font-weight: 600; letter-spacing: .02em; margin: 0 0 1rem; }
  .qr { background: #fff; padding: 16px; border-radius: 16px; display: inline-block; }
  .qr svg { width: 260px; height: 260px; display: block; }
  code { font-size: 2.4rem; letter-spacing: .3em; display: block; margin: 1rem 0 .25rem; }
  .muted { color: #8b90a0; font-size: .9rem; }
</style>
</head>
<body>
<main>
  <h1>Pair your phone</h1>
  <div class="qr">${svg}</div>
  <code>${info.code}</code>
  <p class="muted">Scan with the Sidequest app, or type the code and<br /><strong>${info.url}</strong></p>
</main>
</body>
</html>`;
}
