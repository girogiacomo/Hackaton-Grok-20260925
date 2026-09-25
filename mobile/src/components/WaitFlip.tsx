import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PublicRunState, TodayBoard } from '../../../shared/events';
import type { useRelay } from '../useRelay';
import { getClientId } from '../storage';
import { colors, pixel, spacing } from '../theme';
import { ChallengeCard } from './ChallengeCard';

type Relay = ReturnType<typeof useRelay>;

function fmt(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Runtime({ run }: { run: PublicRunState }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [run.runId]);
  const elapsed = (now - run.startedAt) / 1000;
  const remaining = run.predictedSeconds - elapsed;
  const label = remaining >= 0 ? `ETA ${fmt(remaining)}` : `OVER ${fmt(-remaining)}`;
  return (
    <View style={styles.topBar} testID="runtime-bar">
      <Text style={styles.topLabel}>Agent</Text>
      <Text testID="runtime" style={styles.topTime}>
        {label}
      </Text>
    </View>
  );
}

function Coin({ phase, face }: { phase: 'idle' | 'spin' | 'landed'; face: 'physical' | 'quiz' | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'spin') return;
    const t = setInterval(() => setTick((n) => n + 1), 120);
    return () => clearInterval(t);
  }, [phase]);
  const spinningFace = tick % 2 === 0 ? 'MOVE' : 'TRIVIA';
  const landed = face === 'quiz' ? 'TRIVIA' : 'MOVE';
  const label = phase === 'spin' ? spinningFace : phase === 'landed' ? landed : 'FLIP';
  const turn = phase === 'spin' ? `${(tick % 8) * 45}deg` : '0deg';
  return (
    <View style={styles.coinWrap}>
      <Text testID="coin-phase" style={styles.hidden}>
        {phase === 'idle' ? 'idle' : phase}
      </Text>
      <View testID="coin" style={[styles.coin, { transform: [{ rotateY: turn }] }]}>
        <View style={styles.coinInner}>
          <Text testID="coin-face" style={styles.coinText}>
            {label}
          </Text>
        </View>
      </View>
      <Text testID="outcome" style={styles.hidden}>
        {phase === 'landed' ? (face === 'quiz' ? 'quiz' : 'physical') : 'spinning'}
      </Text>
    </View>
  );
}

function Chart({ today }: { today: TodayBoard }) {
  const max = Math.max(1, today.physical, today.trivia);
  return (
    <View testID="chart" style={styles.sign}>
      <Text style={styles.signTitle}>Today</Text>
      <Bar testID="chart-physical" label="Move" value={today.physical} max={max} color="#7CFF6B" />
      <Bar testID="chart-trivia" label="Trivia" value={today.trivia} max={max} color={colors.gold} />
    </View>
  );
}

function Bar({
  testID,
  label,
  value,
  max,
  color,
}: {
  testID: string;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text testID={testID} style={styles.barValue}>
        {value}
      </Text>
    </View>
  );
}

export function WaitFlip({ relay }: { relay: Relay }) {
  const { run, quizResult, today, send } = relay;
  const [phase, setPhase] = useState<'idle' | 'spin' | 'landed'>('idle');
  const [doneSeq, setDoneSeq] = useState<number | null>(null);
  const seq = run?.challengeSeq ?? 0;

  useEffect(() => {
    if (!run) {
      setPhase('idle');
      return;
    }
    setPhase('spin');
    const timer = setTimeout(() => setPhase('landed'), 1600);
    return () => clearTimeout(timer);
  }, [run?.runId, run?.challengeSeq]);

  const face: 'physical' | 'quiz' | null =
    run?.coin === 'quiz' || run?.challenge?.kind === 'quiz'
      ? 'quiz'
      : run?.coin === 'physical' || run?.challenge?.kind === 'physical'
        ? 'physical'
        : null;
  const showChallenge = !!run?.challenge && phase === 'landed';
  const finished = doneSeq === seq && phase === 'landed';

  return (
    <View style={styles.sky}>
      <View style={[styles.cloud, { top: 36, left: 16 }]} />
      <View style={[styles.cloud, { top: 78, right: 24, width: 90 }]} />
      <View style={[styles.cloud, { top: 18, right: 80, width: 54 }]} />
      <ScrollView contentContainerStyle={styles.scroll} testID="screen">
        {run ? <Runtime run={run} /> : <View style={styles.topSpacer} />}
        <Text style={styles.title}>WAIT FLIP</Text>
        {run?.prompt ? (
          <Text testID="prompt" style={styles.prompt}>
            {run.prompt}
          </Text>
        ) : null}
        {!run ? (
          <Text testID="waiting" style={styles.wait}>
            Waiting for the agent to take off
          </Text>
        ) : (
          <View style={styles.play}>
            <Coin phase={phase === 'idle' ? 'spin' : phase} face={face} />
            {showChallenge ? (
              <View style={styles.card}>
                <ChallengeCard
                  key={`${run.runId}-${seq}`}
                  run={run}
                  quizResult={quizResult}
                  send={send}
                  onFinished={() => setDoneSeq(seq)}
                />
                {finished ? (
                  <Pressable
                    testID="toss-again"
                    style={styles.toss}
                    onPress={() => send({ type: 'flip', clientId: getClientId() })}
                  >
                    <Text style={styles.tossText}>Toss again</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.wait}>{phase === 'landed' ? 'Catching the challenge' : 'The coin is in the air'}</Text>
            )}
          </View>
        )}
        <Chart today={today} />
      </ScrollView>
      <View style={styles.grass}>
        <View style={styles.grassTop} />
        <View style={styles.dirt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { flex: 1, backgroundColor: colors.sky },
  scroll: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  cloud: {
    position: 'absolute',
    width: 120,
    height: 36,
    backgroundColor: colors.cloud,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.ink,
    opacity: 0.95,
  },
  topSpacer: { height: 8 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 4,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
    boxShadow: '4px 4px 0 #1b1208',
  },
  topLabel: { fontFamily: pixel, fontSize: 10, color: colors.ink, lineHeight: 18 },
  topTime: { fontFamily: pixel, fontSize: 14, color: colors.ink, lineHeight: 22 },
  title: {
    fontFamily: pixel,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 34,
    textShadow: '3px 3px 0 #ffffff',
  },
  prompt: { fontFamily: pixel, fontSize: 8, color: colors.ink, textAlign: 'center', lineHeight: 14 },
  wait: { fontFamily: pixel, fontSize: 11, color: colors.ink, textAlign: 'center', lineHeight: 20 },
  play: { gap: spacing.md, alignItems: 'center' },
  coinWrap: { alignItems: 'center', marginTop: spacing.sm },
  coin: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.gold,
    borderWidth: 6,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '6px 6px 0 #1b1208',
  },
  coinInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: colors.goldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe56a',
  },
  coinText: { fontFamily: pixel, fontSize: 12, color: colors.ink, lineHeight: 20, textAlign: 'center' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 4,
    borderColor: colors.ink,
    padding: spacing.md,
    gap: spacing.md,
    boxShadow: '4px 4px 0 #1b1208',
  },
  toss: {
    backgroundColor: colors.gold,
    borderWidth: 4,
    borderColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: '4px 4px 0 #1b1208',
  },
  tossText: { fontFamily: pixel, fontSize: 12, color: colors.ink, lineHeight: 20 },
  sign: {
    alignSelf: 'stretch',
    backgroundColor: '#e0a45a',
    borderWidth: 4,
    borderColor: colors.ink,
    padding: spacing.md,
    gap: spacing.sm,
    boxShadow: '4px 4px 0 #1b1208',
  },
  signTitle: { fontFamily: pixel, fontSize: 12, color: colors.ink, lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { fontFamily: pixel, fontSize: 8, color: colors.ink, width: 58, lineHeight: 14 },
  barTrack: { flex: 1, height: 18, backgroundColor: '#fff6d8', borderWidth: 3, borderColor: colors.ink },
  barFill: { height: '100%' },
  barValue: { fontFamily: pixel, fontSize: 12, color: colors.ink, width: 28, textAlign: 'right', lineHeight: 18 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 },
  grassTop: { height: 18, backgroundColor: colors.grass, borderTopWidth: 4, borderTopColor: colors.ink },
  dirt: { flex: 1, backgroundColor: colors.dirt, borderTopWidth: 4, borderTopColor: '#8a5a22' },
});
