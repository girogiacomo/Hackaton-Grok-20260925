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
  /** Coin face for the current toss. The person does not choose it. */
  coin?: 'physical' | 'quiz';
  /** Increments every toss so the phone can replay the flip. */
  challengeSeq?: number;
  /** Agents still working in this wait. Parallel chats share one clock. */
  activeAgents?: number;
  /** Bumps when one agent finishes while others are still running, so the phone can flash. */
  agentPulse?: number;
  /** Short line for that flash, e.g. one finished and one is still going. */
  agentNote?: string;
}

export interface TodayBoard {
  day: string;
  physical: number;
  trivia: number;
}

export interface Stats {
  runs: number;
  minutesReclaimed: number;
  repsDone: number;
  quizzesRight: number;
  quizzesAnswered: number;
}

export type WsMessage =
  | { type: 'hello'; run: RunState | null; stats: Stats; today?: TodayBoard }
  | { type: 'run:start'; run: RunState }
  | { type: 'run:progress'; run: RunState }
  | { type: 'run:done'; run: RunState; stats: Stats }
  | { type: 'stats'; stats: Stats }
  | { type: 'today'; today: TodayBoard }
  | { type: 'quiz:result'; runId: string; correct: boolean; answerIndex?: number };

/** Phone -> server over WS. */
export type WsClientMessage =
  | { type: 'quiz:answer'; runId: string; answerIndex: number; clientId?: string }
  | { type: 'physical:done'; runId: string; reps: number; clientId?: string }
  | { type: 'flip'; clientId?: string }
  | { type: 'mode'; mode: ChallengeMode };

/** Quiz challenge as sent to the phone while the run is live (answer withheld). */
export type PublicQuizChallenge = Omit<QuizChallenge, 'answerIndex' | 'explanation'> & {
  answerIndex?: number;
  explanation?: string;
};
export type PublicChallenge = PhysicalChallenge | GameChallenge | PublicQuizChallenge;
export type PublicRunState = Omit<RunState, 'challenge'> & { challenge?: PublicChallenge };
