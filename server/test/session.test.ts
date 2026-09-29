import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elapsedSeconds, playSession } from '../../shared/session.ts';

test('play session stays open until the agent stops', () => {
  assert.equal(playSession(undefined), 'idle');
  assert.equal(playSession('idle'), 'idle');
  assert.equal(playSession('running'), 'live');
  assert.equal(playSession('done'), 'stopped');
});

test('elapsed clock ignores the estimate and freezes when the agent stops', () => {
  const startedAt = 1_000_000;
  const running = { status: 'running' as const, startedAt };
  assert.equal(elapsedSeconds(running, startedAt + 120_000), 120);

  const stopped = { status: 'done' as const, startedAt, endedAt: startedAt + 40_000 };
  assert.equal(elapsedSeconds(stopped, startedAt + 120_000), 40);
});
