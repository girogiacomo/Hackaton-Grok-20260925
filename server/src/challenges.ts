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
  /** Floor for tiny tasks such as one glass of water. Defaults to 5 reps or 20 seconds. */
  min?: number;
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
  { name: 'Walk to the kitchen and back', unit: 'seconds', perMinute: 40, max: 120 },
  { name: 'Eyes on something far away', unit: 'seconds', perMinute: 20, max: 40, min: 20 },
  { name: 'Stand up and sit back down', unit: 'reps', perMinute: 8, max: 12, min: 1 },
  { name: 'Drink some water', unit: 'reps', perMinute: 1, max: 2, min: 1 },
  { name: 'Refill your glass', unit: 'reps', perMinute: 1, max: 1, min: 1 },
  { name: 'Wash your hands', unit: 'reps', perMinute: 1, max: 1, min: 1 },
  { name: 'Tidy one thing on the desk', unit: 'reps', perMinute: 1, max: 3, min: 1 },
  { name: 'Walk one lap of the room', unit: 'reps', perMinute: 2, max: 4, min: 1 },
  { name: 'Yawn on purpose', unit: 'reps', perMinute: 3, max: 5, min: 1 },
  { name: 'Shoulder shrugs', unit: 'reps', perMinute: 20, max: 40, min: 5 },
  { name: 'Shake out your hands', unit: 'seconds', perMinute: 20, max: 30, min: 10 },
  { name: 'Shake out your legs', unit: 'seconds', perMinute: 20, max: 30, min: 10 },
  { name: 'Wrist circles', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'Ankle circles', unit: 'reps', perMinute: 16, max: 24, min: 8 },
  { name: 'Roll your shoulders back', unit: 'reps', perMinute: 12, max: 20, min: 5 },
  { name: 'Reach both arms overhead', unit: 'reps', perMinute: 10, max: 16, min: 4 },
  { name: 'Side bends', unit: 'reps', perMinute: 16, max: 24, min: 6 },
  { name: 'Torso twists', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'March in place', unit: 'seconds', perMinute: 40, max: 60, min: 20 },
  { name: 'Step side to side', unit: 'seconds', perMinute: 40, max: 60, min: 20 },
  { name: 'Slow breaths', unit: 'seconds', perMinute: 40, max: 60, min: 20 },
  { name: 'Box breathing', unit: 'seconds', perMinute: 40, max: 80, min: 20 },
  { name: 'Unclench your jaw', unit: 'seconds', perMinute: 20, max: 30, min: 10 },
  { name: 'Blink slowly', unit: 'reps', perMinute: 15, max: 20, min: 8 },
  { name: 'Look out the window', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Open a window or the door', unit: 'reps', perMinute: 1, max: 1, min: 1 },
  { name: 'Wall push-ups', unit: 'reps', perMinute: 16, max: 25, min: 5 },
  { name: 'Desk push-ups', unit: 'reps', perMinute: 12, max: 20, min: 5 },
  { name: 'Glute bridges', unit: 'reps', perMinute: 15, max: 24, min: 6 },
  { name: 'Standing quad stretch', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Calf stretch on the wall', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Doorway chest stretch', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Hip flexor stretch', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Seated spinal twist', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Balance on one foot', unit: 'seconds', perMinute: 20, max: 30, min: 10 },
  { name: 'Arm circles', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'Easy high knees', unit: 'reps', perMinute: 24, max: 40, min: 10 },
  { name: 'Glute squeezes', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'Shoulder blade squeezes', unit: 'reps', perMinute: 16, max: 24, min: 6 },
  { name: 'Chin tucks', unit: 'reps', perMinute: 12, max: 16, min: 5 },
  { name: 'Ear-to-shoulder stretch', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Fist squeezes', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'Finger spreads', unit: 'reps', perMinute: 16, max: 24, min: 6 },
  { name: 'Palm presses', unit: 'reps', perMinute: 12, max: 20, min: 5 },
  { name: 'Star jumps', unit: 'reps', perMinute: 15, max: 25, min: 5 },
  { name: 'Imaginary jump rope', unit: 'seconds', perMinute: 30, max: 40, min: 15 },
  { name: 'Dance for one chorus', unit: 'seconds', perMinute: 30, max: 45, min: 15 },
  { name: 'Standing knee hugs', unit: 'reps', perMinute: 10, max: 16, min: 4 },
  { name: 'Heel raises', unit: 'reps', perMinute: 20, max: 30, min: 8 },
  { name: 'Toe raises', unit: 'reps', perMinute: 16, max: 24, min: 6 },
  { name: 'Wall angels', unit: 'reps', perMinute: 10, max: 16, min: 4 },
  { name: 'Touch your toes, or as far as is easy', unit: 'reps', perMinute: 8, max: 12, min: 3 },
];

/** Scale reps to roughly two thirds of the predicted wait, leaving time to sit back down. */
export function scaleExercise(ex: Exercise, predictedSeconds: number): number {
  const floor = ex.min ?? (ex.unit === 'reps' ? 5 : 20);
  const step = ex.unit === 'seconds' ? 10 : floor <= 2 ? 1 : 5;
  const usable = Math.max(20, predictedSeconds * 0.66);
  const raw = (ex.perMinute * usable) / 60;
  const rounded = Math.round(raw / step) * step;
  return Math.max(floor, Math.min(ex.max, rounded || floor));
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Each toss of the same run should land somewhere else in the pool. */
function tossSeed(run: RunState, shift = 0): number {
  return hash(`${run.runId}:${run.challengeSeq ?? 0}`) >> shift;
}

const FALLBACK_MOTIVATION = [
  'The agent is typing. You are moving. Fair trade.',
  'Compile time is body time.',
  'Every rep is one less minute of doomscrolling.',
  'Blood flow to the brain improves code review. Probably.',
  'Ship the squats, then ship the diff.',
  'Small counts. Water counts. Standing up counts.',
  'The diff can wait twenty seconds. Your neck cannot.',
  'One glass of water is a complete feature.',
  'You do not have to suffer. Shake your hands and sit back down.',
  'The agent has the hard job. Yours is allowed to be easy.',
  'A lap of the room is a context switch for your spine.',
  'Unclench. The bug will still be there, slightly less tense.',
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
    question: 'What does the median do better than the mean for predicting agent run time?',
    options: ['It is faster to compute', 'It ignores one very long outlier run', 'It always predicts higher', 'It needs fewer samples'],
    answerIndex: 1,
    explanation: 'One 20-minute run should not double every prediction; the median shrugs it off.',
  },
  {
    kind: 'quiz',
    question: 'How many bits are in a byte?',
    options: ['4', '8', '16', '32'],
    answerIndex: 1,
    explanation: 'A byte is 8 bits. A nibble is 4.',
  },
  {
    kind: 'quiz',
    question: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Core Program Utility', 'Cached Page Upload'],
    answerIndex: 0,
    explanation: 'Central Processing Unit, the chip that runs instructions.',
  },
  {
    kind: 'quiz',
    question: 'What does CSS stand for?',
    options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Syntax System', 'Color and Size Spec'],
    answerIndex: 1,
    explanation: 'Cascading Style Sheets, the language that styles HTML.',
  },
  {
    kind: 'quiz',
    question: 'What does HTTP stand for?',
    options: ['HyperText Transfer Protocol', 'High Throughput Text Pipe', 'Host Transfer Type Packet', 'Hyperlink Text Transport Path'],
    answerIndex: 0,
    explanation: 'HyperText Transfer Protocol. HTTPS is the same thing over TLS.',
  },
  {
    kind: 'quiz',
    question: 'Which color is #000000?',
    options: ['White', 'Red', 'Black', 'Blue'],
    answerIndex: 2,
    explanation: 'All zeros is black. #FFFFFF is white.',
  },
  {
    kind: 'quiz',
    question: 'Which HTML tag makes a link?',
    options: ['<link>', '<a>', '<href>', '<url>'],
    answerIndex: 1,
    explanation: '`<a href="...">` is the anchor. `<link>` is for things like stylesheets.',
  },
  {
    kind: 'quiz',
    question: 'What does `git status` tell you?',
    options: ['Who wrote the file', 'What is changed and not yet committed', 'The remote URL', 'How long the last commit took'],
    answerIndex: 1,
    explanation: 'It lists staged, unstaged, and untracked changes in the working tree.',
  },
  {
    kind: 'quiz',
    question: 'In JavaScript, what is `true && false`?',
    options: ['true', 'false', 'null', 'undefined'],
    answerIndex: 1,
    explanation: 'AND is only true when both sides are true.',
  },
  {
    kind: 'quiz',
    question: 'Which of these is a JavaScript comment?',
    options: ['# note', '// note', '<!-- note -->', '-- note'],
    answerIndex: 1,
    explanation: '`//` is a line comment. `#` is Python or shell. `<!--` is HTML.',
  },
  {
    kind: 'quiz',
    question: 'What is 10 in binary?',
    options: ['2', '10', '1010', '1000'],
    answerIndex: 2,
    explanation: '1010 is eight plus two. 1000 is eight.',
  },
  {
    kind: 'quiz',
    question: 'Which port is the usual one for HTTP?',
    options: ['21', '22', '80', '443'],
    answerIndex: 2,
    explanation: '80 is HTTP. 443 is HTTPS. 22 is SSH. 21 is FTP.',
  },
  {
    kind: 'quiz',
    question: 'A boolean can be which pair of values?',
    options: ['yes and no', 'true and false', '1 and 2', 'on and maybe'],
    answerIndex: 1,
    explanation: 'true and false. Some languages also treat other values as truthy.',
  },
  {
    kind: 'quiz',
    question: 'What does `www` stand for?',
    options: ['World Wide Web', 'Wireless Web Window', 'Web Widget Wrapper', 'Wide World Workstation'],
    answerIndex: 0,
    explanation: 'World Wide Web. It is just a hostname convention, not a protocol.',
  },
  {
    kind: 'quiz',
    question: 'Which git command downloads new commits from the remote?',
    options: ['git push', 'git pull', 'git stash', 'git blame'],
    answerIndex: 1,
    explanation: '`git pull` fetches and merges. `git push` sends your commits up.',
  },
  {
    kind: 'quiz',
    question: 'What does a semicolon usually end in JavaScript?',
    options: ['A file', 'A statement', 'A folder', 'A comment'],
    answerIndex: 1,
    explanation: 'It ends a statement. ASI can insert some of them for you.',
  },
  {
    kind: 'quiz',
    question: 'How many sides does a triangle have?',
    options: ['2', '3', '4', '5'],
    answerIndex: 1,
    explanation: 'Three. A square has four.',
  },
  {
    kind: 'quiz',
    question: 'How many minutes are in an hour?',
    options: ['30', '60', '90', '100'],
    answerIndex: 1,
    explanation: 'Sixty. A day has 24 of those.',
  },
  {
    kind: 'quiz',
    question: 'Water freezes at what temperature, in Celsius?',
    options: ['-10', '0', '32', '100'],
    answerIndex: 1,
    explanation: '0°C. 32 is Fahrenheit. 100°C is boiling.',
  },
  {
    kind: 'quiz',
    question: 'Which of these is a fruit?',
    options: ['Carrot', 'Broccoli', 'Apple', 'Potato'],
    answerIndex: 2,
    explanation: 'An apple. The others are vegetables, botanist arguments aside.',
  },
  {
    kind: 'quiz',
    question: 'What day comes after Friday?',
    options: ['Thursday', 'Sunday', 'Saturday', 'Monday'],
    answerIndex: 2,
    explanation: 'Saturday. Then Sunday.',
  },
  {
    kind: 'quiz',
    question: 'Which animal says "moo"?',
    options: ['Duck', 'Cow', 'Cat', 'Bee'],
    answerIndex: 1,
    explanation: 'A cow. A duck quacks, a cat meows, a bee buzzes.',
  },
  {
    kind: 'quiz',
    question: 'How many hours are in a day?',
    options: ['12', '24', '48', '60'],
    answerIndex: 1,
    explanation: '24. Twelve hours is half a day.',
  },
  {
    kind: 'quiz',
    question: 'What is 2 + 2?',
    options: ['3', '4', '5', '22'],
    answerIndex: 1,
    explanation: 'Four. Even in code, unless someone overloaded the operator.',
  },
  {
    kind: 'quiz',
    question: 'Which of these is a primary color of light?',
    options: ['Red', 'Brown', 'Pink', 'Black'],
    answerIndex: 0,
    explanation: 'Red, green, and blue. Screens mix light, not paint.',
  },
  {
    kind: 'quiz',
    question: 'What does SQL stand for?',
    options: ['Structured Query Language', 'Simple Question List', 'Server Queue Layer', 'Sequential Query Loop'],
    answerIndex: 0,
    explanation: 'Structured Query Language, used to talk to relational databases.',
  },
  {
    kind: 'quiz',
    question: 'In CSS, which property changes the text color?',
    options: ['font-color', 'text-style', 'color', 'ink'],
    answerIndex: 2,
    explanation: '`color`. There is no `font-color`.',
  },
  {
    kind: 'quiz',
    question: 'What does `404` mean?',
    options: ['Server on fire', 'Not found', 'Payment required', 'I am a teapot'],
    answerIndex: 1,
    explanation: 'Not Found. 418 is the teapot. 402 is payment required.',
  },
  {
    kind: 'quiz',
    question: 'Which symbol starts a Python comment?',
    options: ['//', '#', '/*', '--'],
    answerIndex: 1,
    explanation: '`#` to the end of the line. `//` is C-family.',
  },
  {
    kind: 'quiz',
    question: 'What is the value of an empty JavaScript array\'s length?',
    options: ['null', 'undefined', '0', '-1'],
    answerIndex: 2,
    explanation: '`[].length` is 0.',
  },
  {
    kind: 'quiz',
    question: 'Which command lists files in a Unix shell?',
    options: ['dirr', 'ls', 'show', 'files'],
    answerIndex: 1,
    explanation: '`ls`. `dir` is the Windows cousin.',
  },
  {
    kind: 'quiz',
    question: 'What does RAM stand for?',
    options: ['Random Access Memory', 'Read And Modify', 'Rapid Application Mode', 'Remote Access Module'],
    answerIndex: 0,
    explanation: 'Random Access Memory, the fast working memory that forgets on shutdown.',
  },
  {
    kind: 'quiz',
    question: 'Which of these is a loop?',
    options: ['if', 'for', 'const', 'import'],
    answerIndex: 1,
    explanation: '`for` repeats. `if` branches once. `const` names a value.',
  },
  {
    kind: 'quiz',
    question: 'JSON object keys are wrapped in what?',
    options: ['Single quotes only', 'Double quotes', 'Backticks', 'Nothing'],
    answerIndex: 1,
    explanation: 'Double quotes. Single quotes are not valid JSON.',
  },
  {
    kind: 'quiz',
    question: 'What does `NaN` stand for?',
    options: ['Not a Number', 'Null and Nothing', 'New array Node', 'Name a Name'],
    answerIndex: 0,
    explanation: 'Not a Number. And `NaN === NaN` is false, which is a gift.',
  },
  {
    kind: 'quiz',
    question: 'Which keyboard shortcut usually saves a file?',
    options: ['Ctrl+S or Cmd+S', 'Ctrl+Q', 'Ctrl+Z', 'Ctrl+P'],
    answerIndex: 0,
    explanation: 'Save. Ctrl+Z undoes, Ctrl+P often prints or opens quick-open.',
  },
  {
    kind: 'quiz',
    question: 'A function that calls itself is called?',
    options: ['A loop', 'Recursive', 'Async', 'Static'],
    answerIndex: 1,
    explanation: 'Recursive. It still needs a base case or it never stops.',
  },
  {
    kind: 'quiz',
    question: 'Which is the smallest unit here?',
    options: ['Kilobyte', 'Megabyte', 'Byte', 'Gigabyte'],
    answerIndex: 2,
    explanation: 'A byte. Then kilobyte, megabyte, gigabyte.',
  },
];

function fallbackPhysical(run: RunState): PhysicalChallenge {
  const seed = tossSeed(run);
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
  return pick(FALLBACK_QUIZZES, tossSeed(run, 3));
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
