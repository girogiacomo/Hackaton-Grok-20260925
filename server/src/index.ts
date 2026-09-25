import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import QRCode from 'qrcode';
import type { WebSocket } from 'ws';
import type {
  ChallengeMode,
  HookEvent,
  HookEventName,
  PublicRunState,
  RunState,
  WsClientMessage,
  WsMessage,
} from '../../shared/events.ts';
import { GrokContentProvider } from './challenges.ts';
import { SqliteStore } from './db.ts';
import { GrokClient } from './grok.ts';
import { codesMatch, generateCode, pairingPageHtml, pairingQrText, publicBaseUrl } from './pairing.ts';
import { PushSender, isExpoPushToken } from './push.ts';
import { RunManager } from './runs.ts';

const PORT = Number(process.env.PORT ?? 4747);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.SIDEQUEST_DB ?? 'sidequest.db';
const PAIR_CODE = process.env.PAIR_CODE ?? generateCode();
const HOOK_EVENTS: HookEventName[] = ['beforeSubmitPrompt', 'postToolUse', 'afterFileEdit', 'afterAgentThought', 'stop'];
const MODES: ChallengeMode[] = ['physical', 'quiz', 'game', 'mixed'];

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
await app.register(cors, { origin: true });
await app.register(websocket);

const store = new SqliteStore(DB_PATH);
const grok = new GrokClient();
const runs = new RunManager(store, new GrokContentProvider(grok));
const push = new PushSender(store, fetch, (m) => app.log.warn(m));

const sockets = new Set<WebSocket>();

/** Strip the quiz answer while the run is live so the phone cannot peek. */
function publicRun(run: RunState): PublicRunState {
  if (run.challenge?.kind === 'quiz' && run.status === 'running') {
    const { answerIndex: _hidden, ...rest } = run.challenge;
    return { ...run, challenge: rest };
  }
  return run;
}

function broadcast(message: WsMessage): void {
  const text = JSON.stringify(
    'run' in message && message.run ? { ...message, run: publicRun(message.run) } : message,
  );
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(text);
  }
}

function describeChallenge(run: RunState): string {
  const c = run.challenge;
  if (!c) return `~${run.predictedSeconds}s wait. Your challenge is loading.`;
  if (c.kind === 'physical') return `${c.reps} ${c.unit === 'reps' ? 'x' : 's'} ${c.exercise} (~${run.predictedSeconds}s wait)`;
  if (c.kind === 'quiz') return `Quiz: ${c.question}`;
  return `Tap-reflex time (~${run.predictedSeconds}s wait)`;
}

runs.on('start', (run) => {
  broadcast({ type: 'run:start', run });
  // Give Grok a moment to fill in the challenge so the notification is useful.
  setTimeout(() => {
    void push.send({
      title: 'Agent started',
      body: describeChallenge(run),
      data: { type: 'run:start', runId: run.runId },
    });
  }, 1500);
});

runs.on('progress', (run) => broadcast({ type: 'run:progress', run }));

let lastDonePushed: string | undefined;
runs.on('done', (run, stats) => {
  broadcast({ type: 'run:done', run, stats });
  // First `done` fires immediately, the second one carries the Grok summary.
  // Push once, on whichever arrives first with a summary, or immediately if Grok is off.
  if (lastDonePushed === run.runId) return;
  if (run.doneSummary || !grok.enabled) {
    lastDonePushed = run.runId;
    const seconds = Math.round(((run.endedAt ?? Date.now()) - run.startedAt) / 1000);
    void push.send({
      title: `Agent done in ${seconds}s`,
      body: run.doneSummary ?? `${run.editedFiles.length} file(s) changed. Head back.`,
      data: { type: 'run:done', runId: run.runId },
    });
  }
});

function isHookEvent(body: unknown): body is HookEvent {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return HOOK_EVENTS.includes(b.event as HookEventName) && typeof b.project === 'string';
}

app.post('/events', async (req, reply) => {
  const body = req.body;
  if (!isHookEvent(body)) return reply.code(400).send({ error: 'invalid hook event' });
  const event: HookEvent = {
    ...body,
    timestamp: typeof body.timestamp === 'number' ? body.timestamp : Date.now(),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
  };
  runs.handle(event);
  return { ok: true };
});

app.get('/health', async () => ({ ok: true, grok: grok.enabled, run: runs.current?.status ?? 'idle' }));

app.get('/state', async (req, reply) => {
  const code = (req.query as { code?: string }).code;
  if (!codesMatch(PAIR_CODE, code)) return reply.code(401).send({ error: 'bad code' });
  return { run: runs.current ? publicRun(runs.current) : null, stats: runs.stats(), mode: runs.mode };
});

app.post('/pair', async (req, reply) => {
  const body = (req.body ?? {}) as { code?: unknown; pushToken?: unknown };
  if (!codesMatch(PAIR_CODE, body.code)) return reply.code(401).send({ error: 'bad code' });
  if (isExpoPushToken(body.pushToken)) {
    store.addDevice(body.pushToken);
    app.log.info(`paired device ${body.pushToken}`);
  }
  return { ok: true, mode: runs.mode, stats: runs.stats(), grok: grok.enabled };
});

app.get('/pair-qr', async (_req, reply) => {
  const info = { url: publicBaseUrl(PORT), code: PAIR_CODE };
  const svg = await QRCode.toString(pairingQrText(info), { type: 'svg', margin: 0 });
  return reply.type('text/html').send(pairingPageHtml(info, svg));
});

app.get('/ws', { websocket: true }, (socket, req) => {
  const code = (req.query as { code?: string }).code;
  if (!codesMatch(PAIR_CODE, code)) {
    socket.close(4001, 'bad code');
    return;
  }
  sockets.add(socket);
  const hello: WsMessage = { type: 'hello', run: runs.current, stats: runs.stats() };
  socket.send(JSON.stringify({ ...hello, run: hello.run ? publicRun(hello.run) : null, mode: runs.mode }));

  socket.on('message', (raw) => {
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as WsClientMessage;
    } catch {
      return;
    }
    if (msg.type === 'quiz:answer') {
      const correct = runs.answerQuiz(msg.runId, msg.answerIndex);
      if (correct !== undefined) {
        socket.send(JSON.stringify({ type: 'quiz:result', runId: msg.runId, correct }));
        broadcast({ type: 'stats', stats: runs.stats() });
      }
    } else if (msg.type === 'physical:done') {
      runs.completePhysical(msg.runId, msg.reps);
      broadcast({ type: 'stats', stats: runs.stats() });
    } else if (msg.type === 'mode' && MODES.includes(msg.mode)) {
      runs.setMode(msg.mode);
      for (const ws of sockets) ws.send(JSON.stringify({ type: 'mode', mode: msg.mode }));
    }
  });
  socket.on('close', () => sockets.delete(socket));
});

await app.listen({ port: PORT, host: HOST });

const info = { url: publicBaseUrl(PORT), code: PAIR_CODE };
const terminalQr = await QRCode.toString(pairingQrText(info), { type: 'terminal', small: true });
console.log(`\n${terminalQr}`);
console.log(`Sidequest relay listening on ${info.url}`);
console.log(`Pairing code: ${PAIR_CODE}   (QR page: ${info.url}/pair-qr)`);
console.log(`Grok: ${grok.enabled ? 'enabled' : 'disabled, set XAI_API_KEY for generated content'}`);
console.log(`Stats: ${JSON.stringify(runs.stats())}\n`);
