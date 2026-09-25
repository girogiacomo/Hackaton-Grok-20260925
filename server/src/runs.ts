import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  Challenge,
  ChallengeMode,
  HookEvent,
  RunState,
  Stats,
} from '../../shared/events.ts';
import type { Store } from './db.ts';

export const DEFAULT_PREDICTION_SECONDS = 90;
const MIN_PREDICTION_SECONDS = 30;
const MAX_PREDICTION_SECONDS = 900;
const PREDICTOR_WINDOW = 10;
/** Only every Nth agent thought is summarised to keep Grok traffic low. */
export const THOUGHT_SUMMARY_EVERY = 3;

/** Content hooks the run manager calls out to; all are optional and async. */
export interface ContentProvider {
  challenge(run: RunState, mode: ChallengeMode): Promise<Challenge>;
  progress(run: RunState, thoughts: string[]): Promise<string | undefined>;
  doneSummary(run: RunState): Promise<string | undefined>;
}

export interface RunManagerEvents {
  start: [run: RunState];
  progress: [run: RunState];
  done: [run: RunState, stats: Stats];
}

/** Rolling median of the last N completed runs of a project, clamped. */
export function predictSeconds(durations: number[]): number {
  const usable = durations.filter((d) => Number.isFinite(d) && d > 0);
  if (usable.length === 0) return DEFAULT_PREDICTION_SECONDS;
  const sorted = [...usable].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(
    Math.min(MAX_PREDICTION_SECONDS, Math.max(MIN_PREDICTION_SECONDS, median)),
  );
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Turns raw hook events into a single live `RunState` and emits
 * start/progress/done. Only one run is tracked at a time: Sidequest is about
 * the human's wait, and the human waits for one thing.
 */
export class RunManager extends EventEmitter<RunManagerEvents> {
  private run: RunState | null = null;
  private thoughts: string[] = [];
  private thoughtCount = 0;
  private summarising = false;

  constructor(
    private readonly store: Store,
    private readonly content: ContentProvider,
  ) {
    super();
  }

  get current(): RunState | null {
    return this.run;
  }

  get mode(): ChallengeMode {
    const saved = this.store.getSetting('mode');
    return (saved as ChallengeMode | undefined) ?? 'mixed';
  }

  setMode(mode: ChallengeMode): void {
    this.store.setSetting('mode', mode);
  }

  stats(): Stats {
    return this.store.stats();
  }

  handle(event: HookEvent): void {
    switch (event.event) {
      case 'beforeSubmitPrompt':
        return this.onStart(event);
      case 'postToolUse':
        return this.onToolUse(event);
      case 'afterFileEdit':
        return this.onFileEdit(event);
      case 'afterAgentThought':
        return this.onThought(event);
      case 'stop':
        return this.onStop(event);
    }
  }

  private onStart(event: HookEvent): void {
    const prompt = str(event.payload.prompt) ?? '';
    if (this.run && this.run.status === 'running') {
      // Follow-up prompt while the agent is still busy: extend the same wait.
      this.run.prompt = prompt || this.run.prompt;
      this.emit('progress', this.run);
      return;
    }
    const project = event.project || 'unknown';
    const run: RunState = {
      runId: randomUUID(),
      project,
      status: 'running',
      prompt,
      startedAt: event.timestamp || Date.now(),
      predictedSeconds: predictSeconds(
        this.store.recentDurations(project, PREDICTOR_WINDOW),
      ),
      toolCalls: 0,
      editedFiles: [],
    };
    this.run = run;
    this.thoughts = [];
    this.thoughtCount = 0;
    this.emit('start', run);

    const mode = this.mode;
    void this.content
      .challenge(run, mode)
      .then((challenge) => {
        if (this.run?.runId !== run.runId) return;
        run.challenge = challenge;
        this.emit('progress', run);
      })
      .catch(() => undefined);
  }

  private onToolUse(_event: HookEvent): void {
    if (!this.run || this.run.status !== 'running') return;
    this.run.toolCalls += 1;
    this.emit('progress', this.run);
  }

  private onFileEdit(event: HookEvent): void {
    if (!this.run || this.run.status !== 'running') return;
    const file = str(event.payload.file_path) ?? str(event.payload.filePath);
    if (file && !this.run.editedFiles.includes(file)) {
      this.run.editedFiles.push(file);
    }
    this.run.toolCalls += 1;
    this.emit('progress', this.run);
  }

  private onThought(event: HookEvent): void {
    if (!this.run || this.run.status !== 'running') return;
    const text = str(event.payload.text) ?? str(event.payload.thought);
    if (!text) return;
    this.thoughts.push(text);
    if (this.thoughts.length > 20) this.thoughts.shift();
    this.thoughtCount += 1;
    if (this.thoughtCount % THOUGHT_SUMMARY_EVERY !== 0 || this.summarising) return;

    const run = this.run;
    this.summarising = true;
    void this.content
      .progress(run, [...this.thoughts])
      .then((note) => {
        if (note && this.run?.runId === run.runId && run.status === 'running') {
          run.progressNote = note;
          this.emit('progress', run);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.summarising = false;
      });
  }

  private onStop(event: HookEvent): void {
    const run = this.run;
    if (!run || run.status !== 'running') return;
    run.status = 'done';
    run.endedAt = event.timestamp || Date.now();
    if (run.challenge?.kind === 'quiz') {
      run.quizAnswerIndex = run.challenge.answerIndex;
      run.quizExplanation = run.challenge.explanation;
    }
    this.store.saveRun(run);
    this.emit('done', run, this.store.stats());

    void this.content
      .doneSummary(run)
      .then((summary) => {
        if (!summary || this.run?.runId !== run.runId) return;
        run.doneSummary = summary;
        this.emit('done', run, this.store.stats());
      })
      .catch(() => undefined);
  }

  /** Phone reports a quiz answer; returns whether it was right. */
  answerQuiz(runId: string, answerIndex: number): boolean | undefined {
    const run = this.run;
    if (!run || run.runId !== runId || run.challenge?.kind !== 'quiz') return undefined;
    const correct = run.challenge.answerIndex === answerIndex;
    this.store.addQuizResult(correct);
    return correct;
  }

  /** Phone reports completed reps for a physical challenge. */
  completePhysical(runId: string, reps: number): void {
    if (!this.run || this.run.runId !== runId) return;
    if (Number.isFinite(reps) && reps > 0) this.store.addReps(Math.round(reps));
  }
}
