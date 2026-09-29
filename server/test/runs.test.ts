import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Challenge, HookEvent, RunState } from '../../shared/events.ts';
import { MemoryStore } from '../src/db.ts';
import { RunManager, predictSeconds, saneTimestamp, DEFAULT_PREDICTION_SECONDS, THOUGHT_SUMMARY_EVERY } from '../src/runs.ts';
import type { ContentProvider } from '../src/runs.ts';
import { scaleExercise, EXERCISES } from '../src/challenges.ts';

const quiz: Challenge = {
  kind: 'quiz',
  question: 'q',
  options: ['a', 'b', 'c', 'd'],
  answerIndex: 2,
  explanation: 'because',
};

function fakeContent(): ContentProvider & { progressCalls: number } {
  const provider = {
    progressCalls: 0,
    async challenge(): Promise<Challenge> {
      return quiz;
    },
    async progress(): Promise<string> {
      provider.progressCalls += 1;
      return 'Editing files';
    },
    async doneSummary(): Promise<string> {
      return 'All done';
    },
  };
  return provider;
}

function ev(
  event: HookEvent['event'],
  payload: Record<string, unknown> = {},
  timestamp = Date.now(),
  conversationId?: string,
): HookEvent {
  return { event, project: 'demo', timestamp, payload, conversationId };
}

const tick = () => new Promise((r) => setImmediate(r));

test('saneTimestamp keeps real hook clocks and replaces junk', () => {
  const now = 1_790_000_000_000;
  assert.equal(saneTimestamp(now - 5_000, now), now - 5_000);
  assert.equal(saneTimestamp(1, now), now);
  assert.equal(saneTimestamp(undefined, now), now);
  assert.equal(saneTimestamp(Number.NaN, now), now);
});

test('predictSeconds uses clamped median with a default', () => {
  assert.equal(predictSeconds([]), DEFAULT_PREDICTION_SECONDS);
  assert.equal(predictSeconds([60, 600, 70]), 70);
  assert.equal(predictSeconds([5]), 30);
  assert.equal(predictSeconds([5000]), 900);
  assert.equal(predictSeconds([40, 80]), 60);
});

test('scaleExercise stays within sane bounds', () => {
  for (const ex of EXERCISES) {
    for (const s of [30, 90, 300, 900]) {
      const n = scaleExercise(ex, s);
      const floor = ex.min ?? (ex.unit === 'reps' ? 5 : 20);
      assert.ok(n <= ex.max, `${ex.name} ${s}s -> ${n} > max`);
      assert.ok(n >= floor, `${ex.name} ${s}s -> ${n} < min ${floor}`);
    }
  }
  assert.ok(scaleExercise(EXERCISES[0], 300) > scaleExercise(EXERCISES[0], 60));
});

test('full run lifecycle emits start, progress and done, and learns durations', async () => {
  const store = new MemoryStore();
  const content = fakeContent();
  const manager = new RunManager(store, content);
  const events: string[] = [];
  let doneRun: RunState | undefined;
  manager.on('start', () => events.push('start'));
  manager.on('progress', () => events.push('progress'));
  manager.on('done', (run) => {
    events.push('done');
    doneRun = run;
  });

  const t0 = 1_000_000;
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'add tests' }, t0));
  assert.equal(manager.current?.status, 'running');
  assert.equal(manager.current?.predictedSeconds, DEFAULT_PREDICTION_SECONDS);
  await tick();
  assert.equal(manager.current?.challenge?.kind, 'quiz');

  manager.handle(ev('postToolUse', { tool_name: 'Shell' }, t0 + 1000));
  manager.handle(ev('afterFileEdit', { file_path: '/p/a.ts' }, t0 + 2000));
  manager.handle(ev('afterFileEdit', { file_path: '/p/a.ts' }, t0 + 3000));
  assert.equal(manager.current?.toolCalls, 3);
  assert.deepEqual(manager.current?.editedFiles, ['/p/a.ts']);

  for (let i = 0; i < THOUGHT_SUMMARY_EVERY; i++) {
    manager.handle(ev('afterAgentThought', { text: `thought ${i}` }));
  }
  await tick();
  assert.equal(content.progressCalls, 1);
  assert.equal(manager.current?.progressNote, 'Editing files');

  // Quiz answer is checked against the hidden index.
  assert.equal(manager.answerQuiz(manager.current!.runId, 2), true);
  assert.equal(manager.answerQuiz(manager.current!.runId, 0), false);

  manager.handle(ev('stop', { status: 'completed' }, t0 + 120_000));
  await tick();
  assert.equal(doneRun?.status, 'done');
  assert.equal(doneRun?.quizAnswerIndex, 2);
  assert.equal(doneRun?.doneSummary, 'All done');
  assert.equal(events[0], 'start');
  assert.ok(events.includes('done'));

  // The next run in the same project is predicted from history (120s).
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'again' }));
  assert.equal(manager.current?.predictedSeconds, 120);

  const stats = store.stats();
  assert.equal(stats.runs, 1);
  assert.equal(stats.quizzesAnswered, 2);
  assert.equal(stats.quizzesRight, 1);
  assert.equal(stats.minutesReclaimed, 2);
});

test('stop without a running run and stray events are ignored', () => {
  const manager = new RunManager(new MemoryStore(), fakeContent());
  let fired = 0;
  manager.on('done', () => fired++);
  manager.handle(ev('stop'));
  manager.handle(ev('postToolUse'));
  assert.equal(fired, 0);
  assert.equal(manager.current, null);
});

test('one of two parallel agents finishing does not end the wait', () => {
  const manager = new RunManager(new MemoryStore(), fakeContent());
  const t0 = 1_700_000_000_000;
  let dones = 0;
  manager.on('done', () => dones++);
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'first' }, t0, 'chat-a'));
  const id = manager.current?.runId;
  const started = manager.current?.startedAt;
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'second' }, t0 + 5_000, 'chat-b'));
  assert.equal(manager.current?.runId, id);
  assert.equal(manager.current?.startedAt, started);
  assert.equal(manager.current?.activeAgents, 2);

  manager.handle(ev('stop', { status: 'completed' }, t0 + 20_000, 'chat-b'));
  assert.equal(dones, 0);
  assert.equal(manager.current?.status, 'running');
  assert.equal(manager.current?.endedAt, undefined);
  assert.equal(manager.current?.activeAgents, 1);
  assert.equal(manager.current?.agentPulse, 1);
  assert.match(manager.current?.agentNote ?? '', /still running/);

  manager.handle(ev('stop', { status: 'completed' }, t0 + 50_000, 'chat-a'));
  assert.equal(dones, 1);
  assert.equal(manager.current?.status, 'done');
  assert.equal(manager.current?.endedAt, t0 + 50_000);
  assert.equal(manager.current?.activeAgents, 0);
});

test('follow-up prompt during a run extends it instead of restarting', () => {
  const manager = new RunManager(new MemoryStore(), fakeContent());
  let starts = 0;
  manager.on('start', () => starts++);
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'one' }));
  const id = manager.current?.runId;
  manager.handle(ev('beforeSubmitPrompt', { prompt: 'two' }));
  assert.equal(starts, 1);
  assert.equal(manager.current?.runId, id);
  assert.equal(manager.current?.prompt, 'two');
});
