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

/** Seconds after the agent stopped. Stays at 0 while the run is still live. */
export function sinceStopSeconds(
  run: { status: AgentStatus; endedAt?: number },
  now: number,
): number {
  if (run.status !== 'done') return 0;
  return Math.max(0, (now - (run.endedAt ?? now)) / 1000);
}
