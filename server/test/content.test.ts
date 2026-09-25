import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RunState } from '../../shared/events.ts';
import { GrokClient } from '../src/grok.ts';
import { GrokContentProvider, FALLBACK_QUIZZES } from '../src/challenges.ts';
import { MemoryStore } from '../src/db.ts';
import { PushSender, isExpoPushToken } from '../src/push.ts';

function run(overrides: Partial<RunState> = {}): RunState {
  return {
    runId: 'r1',
    project: 'demo',
    status: 'running',
    prompt: 'Add tests for the auth middleware',
    startedAt: 1000,
    predictedSeconds: 90,
    toolCalls: 0,
    editedFiles: [],
    ...overrides,
  };
}

function fakeFetch(handler: (body: any) => unknown, status = 200): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(handler(body)), { status });
  }) as unknown as typeof fetch;
}

function chat(content: string) {
  return { choices: [{ message: { content } }] };
}

test('GrokClient is disabled without a key and returns undefined', async () => {
  const grok = new GrokClient({ apiKey: undefined, fetchImpl: fakeFetch(() => chat('x')) });
  assert.equal(grok.enabled, false);
  assert.equal(await grok.complete('s', 'u'), undefined);
});

test('quiz uses Grok JSON when valid and falls back otherwise', async () => {
  const good = new GrokClient({
    apiKey: 'k',
    fetchImpl: fakeFetch((body) => {
      assert.equal(body.response_format?.type, 'json_object');
      return chat(
        '```json\n{"question":"What does JWT stand for?","options":["a","b","c","d"],"answerIndex":3,"explanation":"e"}\n```',
      );
    }),
  });
  const q = await new GrokContentProvider(good).challenge(run(), 'quiz');
  assert.equal(q.kind, 'quiz');
  if (q.kind === 'quiz') {
    assert.equal(q.question, 'What does JWT stand for?');
    assert.equal(q.answerIndex, 3);
  }

  const bad = new GrokClient({ apiKey: 'k', fetchImpl: fakeFetch(() => chat('{"question": 1}')) });
  const fb = await new GrokContentProvider(bad).challenge(run(), 'quiz');
  assert.ok(FALLBACK_QUIZZES.some((f) => f.question === (fb as { question: string }).question));
});

test('physical challenge keeps deterministic exercise, Grok only writes the line', async () => {
  const grok = new GrokClient({ apiKey: 'k', fetchImpl: fakeFetch(() => chat('"Move it."')) });
  const c = await new GrokContentProvider(grok).challenge(run(), 'physical');
  assert.equal(c.kind, 'physical');
  if (c.kind === 'physical') {
    assert.equal(c.motivation, 'Move it.');
    assert.ok(c.reps > 0);
  }
});

test('HTTP errors fall back to canned done summary', async () => {
  const grok = new GrokClient({ apiKey: 'k', fetchImpl: fakeFetch(() => ({ error: 'nope' }), 500) });
  const s = await new GrokContentProvider(grok).doneSummary(
    run({ status: 'done', endedAt: 61000, editedFiles: ['/p/src/a.ts', '/p/src/b.ts'] }),
  );
  assert.equal(s, 'Done. 2 files changed, start with a.ts.');
});

test('push sender drops unregistered devices', async () => {
  const store = new MemoryStore();
  store.addDevice('ExponentPushToken[aaa]');
  store.addDevice('ExponentPushToken[bbb]');
  const sender = new PushSender(
    store,
    (async (_url: unknown, init?: RequestInit) => {
      const msgs = JSON.parse(String(init?.body)) as { to: string }[];
      assert.equal(msgs.length, 2);
      return new Response(
        JSON.stringify({
          data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
        }),
      );
    }) as unknown as typeof fetch,
  );
  await sender.send({ title: 't', body: 'b' });
  assert.deepEqual(store.devices(), ['ExponentPushToken[aaa]']);
});

test('isExpoPushToken validates shape', () => {
  assert.ok(isExpoPushToken('ExponentPushToken[xyz-123_ABC]'));
  assert.ok(isExpoPushToken('ExpoPushToken[xyz]'));
  assert.equal(isExpoPushToken('nope'), false);
  assert.equal(isExpoPushToken(null), false);
});
