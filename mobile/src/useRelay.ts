import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import type {
  ChallengeMode,
  PublicRunState,
  Stats,
  TodayBoard,
  WsClientMessage,
} from '../../shared/events';
import { notifyLocal } from './notifications';
import { wsUrl, type Pairing } from './storage';

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'rejected';

type ServerMessage =
  | { type: 'hello'; run: PublicRunState | null; stats: Stats; mode?: ChallengeMode; today?: TodayBoard }
  | { type: 'run:start'; run: PublicRunState }
  | { type: 'run:progress'; run: PublicRunState }
  | { type: 'run:done'; run: PublicRunState; stats: Stats }
  | { type: 'stats'; stats: Stats }
  | { type: 'mode'; mode: ChallengeMode }
  | { type: 'today'; today: TodayBoard }
  | { type: 'quiz:result'; runId: string; correct: boolean; answerIndex?: number };

export interface RelayState {
  status: ConnectionStatus;
  run: PublicRunState | null;
  stats: Stats | null;
  mode: ChallengeMode;
  quizResult: { runId: string; correct: boolean; answerIndex?: number } | null;
  today: TodayBoard;
  send: (msg: WsClientMessage) => void;
  /** Clears a finished run from the screen. */
  dismissRun: () => void;
}

const EMPTY_STATS: Stats = { runs: 0, minutesReclaimed: 0, repsDone: 0, quizzesRight: 0, quizzesAnswered: 0 };
const EMPTY_TODAY: TodayBoard = { day: '', physical: 0, trivia: 0 };

function describeStart(run: PublicRunState): string {
  const c = run.challenge;
  if (!c) return `~${run.predictedSeconds}s wait. Challenge loading.`;
  if (c.kind === 'physical') return `${c.reps} ${c.unit === 'reps' ? 'x' : 's'} ${c.exercise}`;
  if (c.kind === 'quiz') return `Quiz: ${c.question}`;
  return 'Tap-reflex time';
}

export function useRelay(pairing: Pairing | null): RelayState {
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [run, setRun] = useState<PublicRunState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mode, setMode] = useState<ChallengeMode>('mixed');
  const [quizResult, setQuizResult] = useState<{ runId: string; correct: boolean; answerIndex?: number } | null>(null);
  const [today, setToday] = useState<TodayBoard>(EMPTY_TODAY);
  const seqRef = useRef<number | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pairing) {
      setStatus('closed');
      return;
    }
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl(pairing));
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage;
        } catch {
          return;
        }
        const background = AppState.currentState !== 'active';
        switch (msg.type) {
          case 'hello':
            seqRef.current = msg.run?.challengeSeq;
            setRun(msg.run);
            setStats(msg.stats ?? EMPTY_STATS);
            if (msg.mode) setMode(msg.mode);
            if (msg.today) setToday(msg.today);
            break;
          case 'run:start':
            seqRef.current = msg.run.challengeSeq;
            setRun(msg.run);
            setQuizResult(null);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'run:progress':
            if (seqRef.current !== msg.run.challengeSeq) {
              seqRef.current = msg.run.challengeSeq;
              setQuizResult(null);
            }
            setRun(msg.run);
            // Notify once the challenge is known, so the banner says what to do.
            if (msg.run.challenge && startNotifiedRef.current !== msg.run.runId) {
              startNotifiedRef.current = msg.run.runId;
              if (background) void notifyLocal('Agent started', describeStart(msg.run));
            }
            break;
          case 'run:done':
            setRun(msg.run);
            setStats(msg.stats);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (background && msg.run.doneSummary) {
              void notifyLocal('Agent done', msg.run.doneSummary);
            }
            break;
          case 'stats':
            setStats(msg.stats);
            break;
          case 'mode':
            setMode(msg.mode);
            break;
          case 'today':
            setToday(msg.today);
            break;
          case 'quiz:result':
            setQuizResult({ runId: msg.runId, correct: msg.correct, answerIndex: msg.answerIndex });
            void Haptics.notificationAsync(
              msg.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
            );
            break;
        }
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        if (disposed) return;
        if (ev.code === 4001) {
          setStatus('rejected');
          return;
        }
        setStatus('closed');
        const delay = Math.min(15000, 1000 * 2 ** retryRef.current++);
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose follows and handles the retry.
      };
    };

    connect();

    // Reconnect promptly when the app returns to the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !wsRef.current && !disposed) {
        if (timerRef.current) clearTimeout(timerRef.current);
        retryRef.current = 0;
        connect();
      }
    });

    return () => {
      disposed = true;
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [pairing?.url, pairing?.code]);

  const send = useCallback((msg: WsClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    if (msg.type === 'mode') setMode(msg.mode);
  }, []);

  const dismissRun = useCallback(() => setRun(null), []);

  return { status, run, stats, mode, quizResult, today, send, dismissRun };
}
