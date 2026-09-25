/**
 * Types shared between the Cursor hook script, the relay server and the phone app.
 * The hook script produces `HookEvent`s; the server turns them into `RunState`
 * and streams `WsMessage`s to phones.
 */

export type HookEventName =
  | 'beforeSubmitPrompt'
  | 'postToolUse'
  | 'afterFileEdit'
  | 'afterAgentThought'
  | 'stop';

/** Payload posted by `hooks/sidequest.sh` to `POST /events`. */
export interface HookEvent {
  event: HookEventName;
  /** Basename of the workspace root, used to key the duration predictor. */
  project: string;
  /** Unix epoch milliseconds when the hook fired. */
  timestamp: number;
  /** Cursor conversation id when present, groups events of one agent run. */
  conversationId?: string;
  /** Raw hook payload from Cursor; only a few fields are read server-side. */
  payload: Record<string, unknown>;
}

export type ChallengeMode = 'physical' | 'quiz' | 'game' | 'mixed';

export interface PhysicalChallenge {
  kind: 'physical';
  exercise: string;
  reps: number;
  unit: 'reps' | 'seconds';
  motivation: string;
}

export interface QuizChallenge {
  kind: 'quiz';
  question: string;
  options: string[];
  /** Index into `options`; only revealed to the phone on `stop`. */
  answerIndex: number;
  explanation: string;
}

export interface GameChallenge {
  kind: 'game';
  game: 'tap-reflex';
  motivation: string;
}

export type Challenge = PhysicalChallenge | QuizChallenge | GameChallenge;

export type RunStatus = 'idle' | 'running' | 'done';

export interface RunState {
  runId: string;
  project: string;
  status: RunStatus;
  prompt: string;
  startedAt: number;
  endedAt?: number;
  /** Predicted duration in seconds at run start. */
  predictedSeconds: number;
  toolCalls: number;
  editedFiles: string[];
  /** Latest one-line Grok description of what the agent is doing. */
  progressNote?: string;
  challenge?: Challenge;
  /** Filled on `stop`. */
  doneSummary?: string;
  quizAnswerIndex?: number;
  quizExplanation?: string;
}

export interface Stats {
  runs: number;
  minutesReclaimed: number;
  repsDone: number;
  quizzesRight: number;
  quizzesAnswered: number;
}

export type WsMessage =
  | { type: 'hello'; run: RunState | null; stats: Stats }
  | { type: 'run:start'; run: RunState }
  | { type: 'run:progress'; run: RunState }
  | { type: 'run:done'; run: RunState; stats: Stats }
  | { type: 'stats'; stats: Stats };

/** Phone -> server over WS. */
export type WsClientMessage =
  | { type: 'quiz:answer'; runId: string; answerIndex: number }
  | { type: 'physical:done'; runId: string; reps: number }
  | { type: 'mode'; mode: ChallengeMode };

/** Quiz challenge as sent to the phone while the run is live (answer withheld). */
export type PublicQuizChallenge = Omit<QuizChallenge, 'answerIndex'> & { answerIndex?: number };
export type PublicChallenge = PhysicalChallenge | GameChallenge | PublicQuizChallenge;
export type PublicRunState = Omit<RunState, 'challenge'> & { challenge?: PublicChallenge };
