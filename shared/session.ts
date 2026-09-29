export type PlayPhase = 'idle' | 'live' | 'stopped';

type AgentStatus = 'idle' | 'running' | 'done';

/**
 * The phone session follows the agent. Predicted ETA is a display hint only:
 * passing it does not end the session, and the session does not wait for it
 * after the agent stops.
 */
export function playSession(status: AgentStatus | undefined): PlayPhase {
  if (status === 'running') return 'live';
  if (status === 'done') return 'stopped';
  return 'idle';
}

/** Elapsed wait. Freezes at `endedAt` once the agent has stopped. */
export function elapsedSeconds(
  run: { status: AgentStatus; startedAt: number; endedAt?: number },
  now: number,
): number {
  const end = run.status === 'done' ? (run.endedAt ?? now) : now;
  return Math.max(0, (end - run.startedAt) / 1000);
}
