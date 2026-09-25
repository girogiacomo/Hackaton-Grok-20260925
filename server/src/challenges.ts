import type {
  Challenge,
  ChallengeMode,
  GameChallenge,
  PhysicalChallenge,
  QuizChallenge,
  RunState,
} from '../../shared/events.ts';
import type { GrokClient } from './grok.ts';
import type { ContentProvider } from './runs.ts';

/**
 * Exercises are a fixed, safe list; only the motivational line comes from Grok.
 * `perMinute` is a comfortable pace for someone stepping away from a desk.
 */
interface Exercise {
  name: string;
  unit: 'reps' | 'seconds';
  perMinute: number;
  max: number;
}

export const EXERCISES: Exercise[] = [
  { name: 'Squats', unit: 'reps', perMinute: 20, max: 40 },
  { name: 'Push-ups', unit: 'reps', perMinute: 12, max: 25 },
  { name: 'Jumping jacks', unit: 'reps', perMinute: 40, max: 80 },
  { name: 'Desk calf raises', unit: 'reps', perMinute: 30, max: 60 },
  { name: 'Lunges (alternating)', unit: 'reps', perMinute: 16, max: 30 },
  { name: 'Wall sit', unit: 'seconds', perMinute: 40, max: 90 },
  { name: 'Plank', unit: 'seconds', perMinute: 35, max: 90 },
  { name: 'Neck and shoulder rolls', unit: 'seconds', perMinute: 45, max: 90 },
  { name: 'Walk to the kitchen and back, twice', unit: 'seconds', perMinute: 60, max: 300 },
  { name: 'Eyes on something 20 metres away', unit: 'seconds', perMinute: 20, max: 40 },
];

/** Scale reps to roughly two thirds of the predicted wait, leaving time to sit back down. */
export function scaleExercise(ex: Exercise, predictedSeconds: number): number {
  const usable = Math.max(20, predictedSeconds * 0.66);
  const raw = (ex.perMinute * usable) / 60;
  const rounded = ex.unit === 'reps' ? Math.round(raw / 5) * 5 : Math.round(raw / 10) * 10;
  return Math.max(ex.unit === 'reps' ? 5 : 20, Math.min(ex.max, rounded));
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const FALLBACK_MOTIVATION = [
  'The agent is typing. You are moving. Fair trade.',
  'Compile time is body time.',
  'Every rep is one less minute of doomscrolling.',
  'Blood flow to the brain improves code review. Probably.',
  'Ship the squats, then ship the diff.',
];

export const FALLBACK_QUIZZES: QuizChallenge[] = [
  {
    kind: 'quiz',
    question: 'Which Cursor hook event fires when the agent finishes a turn?',
    options: ['afterAgentResponse', 'stop', 'sessionEnd', 'postToolUse'],
    answerIndex: 1,
    explanation: '`stop` is the completion event; `sessionEnd` is the whole editor session.',
  },
  {
    kind: 'quiz',
    question: 'Which HTTP status means "the request was fine, there is just nothing to return"?',
    options: ['200', '201', '204', '304'],
    answerIndex: 2,
    explanation: '204 No Content. 304 is a cache hit, 201 means something was created.',
  },
  {
    kind: 'quiz',
    question: 'In git, what does `git rebase -i HEAD~3` let you do?',
    options: ['Delete the last three branches', 'Edit the last three commits', 'Reset three files', 'Fetch three remotes'],
    answerIndex: 1,
    explanation: 'Interactive rebase over the last three commits: reorder, squash, reword.',
  },
  {
    kind: 'quiz',
    question: 'What does the `median` do better than the `mean` for predicting agent run time?',
    options: ['It is faster to compute', 'It ignores one very long outlier run', 'It always predicts higher', 'It needs fewer samples'],
    answerIndex: 1,
    explanation: 'One 20-minute run should not double every prediction; the median shrugs it off.',
  },
];

function fallbackPhysical(run: RunState): PhysicalChallenge {
  const seed = hash(run.runId);
  const ex = pick(EXERCISES, seed);
  return {
    kind: 'physical',
    exercise: ex.name,
    reps: scaleExercise(ex, run.predictedSeconds),
    unit: ex.unit,
    motivation: pick(FALLBACK_MOTIVATION, seed >> 3),
  };
}

function fallbackQuiz(run: RunState): QuizChallenge {
  return pick(FALLBACK_QUIZZES, hash(run.runId));
}

function fallbackGame(run: RunState): GameChallenge {
  return {
    kind: 'game',
    game: 'tap-reflex',
    motivation: pick(FALLBACK_MOTIVATION, hash(run.runId) >> 5),
  };
}

function resolveMode(mode: ChallengeMode, run: RunState): Exclude<ChallengeMode, 'mixed'> {
  if (mode !== 'mixed') return mode;
  const order: Exclude<ChallengeMode, 'mixed'>[] = ['physical', 'quiz', 'game'];
  return pick(order, hash(run.runId) >> 7);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Content provider: Grok when configured, canned content otherwise or on failure. */
export class GrokContentProvider implements ContentProvider {
  constructor(private readonly grok: GrokClient) {}

  async challenge(run: RunState, mode: ChallengeMode): Promise<Challenge> {
    const kind = resolveMode(mode, run);
    if (kind === 'physical') return this.physical(run);
    if (kind === 'quiz') return this.quiz(run);
    return this.game(run);
  }

  private async physical(run: RunState): Promise<PhysicalChallenge> {
    const base = fallbackPhysical(run);
    const line = await this.grok.complete(
      'You write one short, dry, funny motivational sentence (max 90 characters) for a software developer who is doing a quick exercise while their AI coding agent works. No emojis, no hashtags, no quotes.',
      `Exercise: ${base.reps} ${base.unit === 'reps' ? 'reps of' : 'seconds of'} ${base.exercise}. The agent was asked: "${truncate(run.prompt, 200)}". Estimated wait: ${run.predictedSeconds}s.`,
    );
    return line ? { ...base, motivation: truncate(line.replace(/^"|"$/g, ''), 120) } : base;
  }

  private async quiz(run: RunState): Promise<QuizChallenge> {
    const result = await this.grok.completeJson<{
      question: string;
      options: string[];
      answerIndex: number;
      explanation: string;
    }>(
      'You write one multiple-choice quiz question for a software developer waiting ~1-2 minutes for an AI coding agent. Base it on the technology, domain or concepts implied by the agent prompt and project name, so answering it primes the developer to review the resulting diff. Exactly 4 options, one correct. Respond with JSON only: {"question": string, "options": string[4], "answerIndex": 0-3, "explanation": string (max 160 chars)}.',
      `Project: ${run.project}\nAgent prompt: "${truncate(run.prompt, 400)}"`,
    );
    if (
      result &&
      typeof result.question === 'string' &&
      Array.isArray(result.options) &&
      result.options.length === 4 &&
      result.options.every((o) => typeof o === 'string') &&
      Number.isInteger(result.answerIndex) &&
      result.answerIndex >= 0 &&
      result.answerIndex < 4
    ) {
      return {
        kind: 'quiz',
        question: result.question,
        options: result.options,
        answerIndex: result.answerIndex,
        explanation: typeof result.explanation === 'string' ? result.explanation : '',
      };
    }
    return fallbackQuiz(run);
  }

  private async game(run: RunState): Promise<GameChallenge> {
    const base = fallbackGame(run);
    const line = await this.grok.complete(
      'You write one short, dry, funny sentence (max 90 characters) inviting a developer to play a 60-second tap-reflex game while their AI coding agent works. No emojis, no quotes.',
      `The agent was asked: "${truncate(run.prompt, 200)}".`,
    );
    return line ? { ...base, motivation: truncate(line.replace(/^"|"$/g, ''), 120) } : base;
  }

  async progress(run: RunState, thoughts: string[]): Promise<string | undefined> {
    const text = await this.grok.complete(
      'Summarise what an AI coding agent is currently doing in ONE sentence of at most 12 words, present tense, starting with a verb (e.g. "Refactoring the auth middleware and adding tests"). No quotes, no trailing period.',
      `Task: "${truncate(run.prompt, 200)}"\nRecent agent thoughts:\n${thoughts.slice(-5).map((t) => `- ${truncate(t, 300)}`).join('\n')}`,
    );
    return text ? truncate(text, 120) : undefined;
  }

  async doneSummary(run: RunState): Promise<string | undefined> {
    const files = run.editedFiles.slice(0, 8).join(', ') || 'no files';
    const text = await this.grok.complete(
      'Write ONE sentence (max 110 characters) telling a developer what their AI coding agent just finished and what to review first. Concrete, no fluff, no quotes.',
      `Task: "${truncate(run.prompt, 300)}"\nEdited files: ${files}\nTool calls: ${run.toolCalls}\nDuration: ${Math.round(((run.endedAt ?? Date.now()) - run.startedAt) / 1000)}s`,
    );
    if (text) return truncate(text, 140);
    const n = run.editedFiles.length;
    return n > 0
      ? `Done. ${n} file${n === 1 ? '' : 's'} changed, start with ${run.editedFiles[0].split('/').pop()}.`
      : 'Done. The agent finished without editing files; read its reply.';
  }
}
