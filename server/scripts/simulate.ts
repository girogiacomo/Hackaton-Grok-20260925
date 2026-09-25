/**
 * Replays a fake Cursor agent run against a running relay, for demos and
 * for developing the phone app without Cursor in the loop.
 *
 *   npm run simulate                # ~25s run against http://127.0.0.1:4747
 *   npm run simulate -- 60          # 60s run
 *   SIDEQUEST_URL=http://host:4747 npm run simulate
 */
import type { HookEvent, HookEventName } from '../../shared/events.ts';

const url = (process.env.SIDEQUEST_URL ?? 'http://127.0.0.1:4747').replace(/\/$/, '');
const totalSeconds = Number(process.argv[2] ?? 25);
const project = process.env.SIDEQUEST_PROJECT ?? 'demo-app';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(event: HookEventName, payload: Record<string, unknown>): Promise<void> {
  const body: HookEvent = {
    event,
    project,
    timestamp: Date.now(),
    conversationId: 'sim',
    payload,
  };
  const res = await fetch(`${url}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`relay answered ${res.status}`);
  console.log(`-> ${event}`);
}

const thoughts = [
  'Reading the existing auth middleware to understand the token flow.',
  'The refresh path lacks a test; I will add one covering expiry.',
  'Creating auth.test.ts with three cases.',
  'Running the test suite to confirm the new cases pass.',
  'One assertion failed on the clock mock, adjusting.',
  'All green. Writing a short summary of the change.',
];
const files = ['src/middleware/auth.ts', 'src/middleware/auth.test.ts', 'package.json'];

await send('beforeSubmitPrompt', {
  prompt: 'Add unit tests for the auth middleware, including token refresh expiry',
  workspace_roots: [`/home/dev/${project}`],
});

const steps = thoughts.length + files.length + 3;
const stepMs = (totalSeconds * 1000) / steps;
let fi = 0;
for (let i = 0; i < steps; i++) {
  await sleep(stepMs);
  if (i % 3 === 2 && fi < files.length) {
    await send('afterFileEdit', { file_path: `/home/dev/${project}/${files[fi++]}` });
  } else if (i < thoughts.length) {
    await send('afterAgentThought', { text: thoughts[i] });
  } else {
    await send('postToolUse', { tool_name: 'Shell' });
  }
}
await send('stop', { status: 'completed' });
console.log('done');
