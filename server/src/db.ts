import Database from 'better-sqlite3';
import type { RunState, Stats } from '../../shared/events.ts';

export interface RunRecord {
  id: string;
  project: string;
  prompt: string;
  startedAt: number;
  endedAt: number;
  predictedSeconds: number;
  toolCalls: number;
  editedFiles: string[];
}

/** Persistence used by the run manager, predictor and pairing. */
export interface Store {
  recentDurations(project: string, limit: number): number[];
  saveRun(run: RunState): void;
  stats(): Stats;
  addReps(reps: number): void;
  addQuizResult(correct: boolean): void;
  devices(): string[];
  addDevice(token: string): void;
  removeDevice(token: string): void;
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  addCompletion(day: string, kind: 'physical' | 'trivia', clientId: string, key: string): boolean;
  today(day: string): { physical: number; trivia: number };
}

/** Calendar day in Italy, so "today" matches the phone in the room. */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        prompt TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        predicted_seconds INTEGER NOT NULL,
        tool_calls INTEGER NOT NULL,
        edited_files TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_project_idx ON runs(project, ended_at DESC);
      CREATE TABLE IF NOT EXISTS devices (
        token TEXT PRIMARY KEY,
        paired_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS counters (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS completions (
        key TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        kind TEXT NOT NULL,
        client_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS completions_day_idx ON completions(day);
    `);
  }

  recentDurations(project: string, limit: number): number[] {
    const rows = this.db
      .prepare<[string, number], { d: number }>(
        'SELECT (ended_at - started_at) / 1000.0 AS d FROM runs WHERE project = ? ORDER BY ended_at DESC LIMIT ?',
      )
      .all(project, limit);
    return rows.map((r) => r.d);
  }

  saveRun(run: RunState): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO runs
          (id, project, prompt, started_at, ended_at, predicted_seconds, tool_calls, edited_files)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.runId,
        run.project,
        run.prompt,
        run.startedAt,
        run.endedAt ?? Date.now(),
        run.predictedSeconds,
        run.toolCalls,
        JSON.stringify(run.editedFiles),
      );
  }

  private counter(key: string): number {
    const row = this.db
      .prepare<[string], { value: number }>('SELECT value FROM counters WHERE key = ?')
      .get(key);
    return row?.value ?? 0;
  }

  private bump(key: string, by: number): void {
    this.db
      .prepare(
        'INSERT INTO counters(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value',
      )
      .run(key, by);
  }

  stats(): Stats {
    const agg = this.db
      .prepare<[], { runs: number; ms: number | null }>(
        'SELECT COUNT(*) AS runs, SUM(ended_at - started_at) AS ms FROM runs',
      )
      .get();
    return {
      runs: agg?.runs ?? 0,
      minutesReclaimed: Math.round(((agg?.ms ?? 0) / 60000) * 10) / 10,
      repsDone: this.counter('reps'),
      quizzesRight: this.counter('quiz_right'),
      quizzesAnswered: this.counter('quiz_answered'),
    };
  }

  addReps(reps: number): void {
    this.bump('reps', reps);
  }

  addQuizResult(correct: boolean): void {
    this.bump('quiz_answered', 1);
    if (correct) this.bump('quiz_right', 1);
  }

  devices(): string[] {
    return this.db
      .prepare<[], { token: string }>('SELECT token FROM devices')
      .all()
      .map((r) => r.token);
  }

  addDevice(token: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO devices(token, paired_at) VALUES (?, ?)')
      .run(token, Date.now());
  }

  removeDevice(token: string): void {
    this.db.prepare('DELETE FROM devices WHERE token = ?').run(token);
  }

  getSetting(key: string): string | undefined {
    return this.db
      .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
      .get(key)?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)')
      .run(key, value);
  }

  addCompletion(day: string, kind: 'physical' | 'trivia', clientId: string, key: string): boolean {
    const result = this.db
      .prepare('INSERT OR IGNORE INTO completions(key, day, kind, client_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(key, day, kind, clientId, Date.now());
    return result.changes > 0;
  }

  today(day: string): { physical: number; trivia: number } {
    const rows = this.db
      .prepare<[string], { kind: string; n: number }>(
        'SELECT kind, COUNT(*) AS n FROM completions WHERE day = ? GROUP BY kind',
      )
      .all(day);
    const board = { physical: 0, trivia: 0 };
    for (const row of rows) {
      if (row.kind === 'physical') board.physical = row.n;
      if (row.kind === 'trivia') board.trivia = row.n;
    }
    return board;
  }
}

/** In-memory store for tests. */
export class MemoryStore implements Store {
  runs: RunState[] = [];
  private reps = 0;
  private quizRight = 0;
  private quizAnswered = 0;
  private deviceSet = new Set<string>();
  private settings = new Map<string, string>();
  private completions: { day: string; kind: 'physical' | 'trivia'; clientId: string; key: string }[] = [];

  recentDurations(project: string, limit: number): number[] {
    return this.runs
      .filter((r) => r.project === project && r.endedAt)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
      .slice(0, limit)
      .map((r) => ((r.endedAt ?? 0) - r.startedAt) / 1000);
  }
  saveRun(run: RunState): void {
    this.runs = this.runs.filter((r) => r.runId !== run.runId);
    this.runs.push({ ...run });
  }
  stats(): Stats {
    const ms = this.runs.reduce((acc, r) => acc + ((r.endedAt ?? 0) - r.startedAt), 0);
    return {
      runs: this.runs.length,
      minutesReclaimed: Math.round((ms / 60000) * 10) / 10,
      repsDone: this.reps,
      quizzesRight: this.quizRight,
      quizzesAnswered: this.quizAnswered,
    };
  }
  addReps(reps: number): void {
    this.reps += reps;
  }
  addQuizResult(correct: boolean): void {
    this.quizAnswered += 1;
    if (correct) this.quizRight += 1;
  }
  devices(): string[] {
    return [...this.deviceSet];
  }
  addDevice(token: string): void {
    this.deviceSet.add(token);
  }
  removeDevice(token: string): void {
    this.deviceSet.delete(token);
  }
  getSetting(key: string): string | undefined {
    return this.settings.get(key);
  }
  setSetting(key: string, value: string): void {
    this.settings.set(key, value);
  }
  addCompletion(day: string, kind: 'physical' | 'trivia', clientId: string, key: string): boolean {
    if (this.completions.some((c) => c.key === key)) return false;
    this.completions.push({ day, kind, clientId, key });
    return true;
  }
  today(day: string): { physical: number; trivia: number } {
    const rows = this.completions.filter((c) => c.day === day);
    return {
      physical: rows.filter((r) => r.kind === 'physical').length,
      trivia: rows.filter((r) => r.kind === 'trivia').length,
    };
  }
}
