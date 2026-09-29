import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PublicRunState, TodayBoard } from '../../../shared/events';
import type { useRelay } from '../useRelay';
import { getClientId, type Look } from '../storage';
import { colors, modernFont, pixel, spacing } from '../theme';
import { ChallengeCard } from './ChallengeCard';

type Relay = ReturnType<typeof useRelay>;

function fmt(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Runtime({ run, look }: { run: PublicRunState | null; look: Look }) {
  const s = look === 'modern' ? modern : classic;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [run?.runId]);
  const elapsed = run ? (now - run.startedAt) / 1000 : 0;
  const remaining = run ? run.predictedSeconds - elapsed : 0;
  const label = !run ? 'ETA --' : remaining >= 0 ? `ETA ${fmt(remaining)}` : `OVER ${fmt(-remaining)}`;
  return (
    <View style={s.topBar} testID="runtime-bar">
      <Text style={s.topLabel}>{run ? 'Agent' : 'Idle'}</Text>
      <Text testID="runtime" style={s.topTime}>
        {label}
      </Text>
    </View>
  );
}

function Coin({ phase, face, look }: { phase: 'idle' | 'spin' | 'landed'; face: 'physical' | 'quiz' | null; look: Look }) {
  const s = look === 'modern' ? modern : classic;
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
    <View style={s.coinWrap}>
      <Text testID="coin-phase" style={s.hidden}>
        {phase === 'idle' ? 'idle' : phase}
      </Text>
      <View testID="coin" style={[s.coin, { transform: [{ rotateY: turn }] }]}>
        <View style={s.coinInner}>
          <Text testID="coin-face" style={s.coinText}>
            {label}
          </Text>
        </View>
      </View>
      <Text testID="outcome" style={s.hidden}>
        {phase === 'landed' ? (face === 'quiz' ? 'quiz' : 'physical') : 'spinning'}
      </Text>
    </View>
  );
}

function Chart({ today, look }: { today: TodayBoard; look: Look }) {
  const s = look === 'modern' ? modern : classic;
  const max = Math.max(1, today.physical, today.trivia);
  return (
    <View testID="chart" style={s.sign}>
      <Text style={s.signTitle}>Today</Text>
      <Bar look={look} testID="chart-physical" label="Move" value={today.physical} max={max} color="#7CFF6B" />
      <Bar look={look} testID="chart-trivia" label="Trivia" value={today.trivia} max={max} color={colors.gold} />
    </View>
  );
}

function Bar({
  look,
  testID,
  label,
  value,
  max,
  color,
}: {
  look: Look;
  testID: string;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const s = look === 'modern' ? modern : classic;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text testID={testID} style={s.barValue}>
        {value}
      </Text>
    </View>
  );
}

function ThemeToggle({ look, onLook }: { look: Look; onLook: (next: Look) => void }) {
  const s = look === 'modern' ? modern : classic;
  return (
    <View testID="theme-toggle" style={s.toggle}>
      <Pressable testID="look-classic" onPress={() => onLook('classic')} style={[s.segment, look === 'classic' && s.segmentOn]}>
        <Text style={[s.segmentText, look === 'classic' && s.segmentTextOn]}>Classic</Text>
      </Pressable>
      <Pressable testID="look-modern" onPress={() => onLook('modern')} style={[s.segment, look === 'modern' && s.segmentOn]}>
        <Text style={[s.segmentText, look === 'modern' && s.segmentTextOn]}>Modern</Text>
      </Pressable>
      <Text testID="look-value" style={s.hidden}>
        {look}
      </Text>
    </View>
  );
}

export function WaitFlip({
  relay,
  look,
  onLook,
}: {
  relay: Relay;
  look: Look;
  onLook: (next: Look) => void;
}) {
  const s = look === 'modern' ? modern : classic;
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
    <View style={s.sky} testID="screen" dataSet={{ look }}>
      {look === 'classic' ? (
        <View pointerEvents="none" style={s.cloudLayer}>
          <View style={[s.cloud, { top: 28, left: 12 }]} />
          <View style={[s.cloud, { top: 92, right: 18, width: 84 }]} />
          <View style={[s.cloud, { top: 150, left: 36, width: 56 }]} />
        </View>
      ) : null}
      <View style={s.column}>
        <View style={s.header}>
          <Runtime run={run} look={look} />
          <ThemeToggle look={look} onLook={onLook} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} testID="scroller">
          <Text testID="title" style={s.title}>{look === 'classic' ? 'WAIT FLIP' : 'Wait Flip'}</Text>
          {run?.prompt ? (
            <Text testID="prompt" style={s.prompt}>
              {run.prompt}
            </Text>
          ) : null}
          {!run ? (
            <Text testID="waiting" style={s.wait}>
              Waiting for the agent to take off
            </Text>
          ) : (
            <View style={s.play}>
              <Coin phase={phase === 'idle' ? 'spin' : phase} face={face} look={look} />
              {showChallenge ? (
                <View style={s.card}>
                  <ChallengeCard
                    key={`${run.runId}-${seq}`}
                    run={run}
                    quizResult={quizResult}
                    send={send}
                    onFinished={() => setDoneSeq(seq)}
                    look={look}
                  />
                  {finished ? (
                    <Pressable
                      testID="toss-again"
                      style={s.toss}
                      onPress={() => send({ type: 'flip', clientId: getClientId() })}
                    >
                      <Text style={s.tossText}>Toss again</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={s.wait}>{phase === 'landed' ? 'Catching the challenge' : 'The coin is in the air'}</Text>
              )}
            </View>
          )}
          <Chart today={today} look={look} />
        </ScrollView>
      </View>
      <View testID="grass" style={s.grass}>
        <View style={s.grassTop} />
        <View style={s.dirt} />
      </View>
    </View>
  );
}

function sheet(look: Look) {
  const classicLook = look === 'classic';
  const font = classicLook ? pixel : modernFont;
  return StyleSheet.create({
    sky: { flex: 1, backgroundColor: colors.sky },
    cloudLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
    cloud: {
      position: 'absolute',
      width: 108,
      height: 32,
      backgroundColor: colors.cloud,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: colors.ink,
    },
    column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', zIndex: 1 },
    header: { paddingHorizontal: 12, paddingTop: 8, gap: 8, zIndex: 2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 28, gap: spacing.md },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      minHeight: 48,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 8px 18px rgba(27,18,8,0.12)',
    },
    topLabel: { fontFamily: font, fontSize: classicLook ? 10 : 14, color: colors.ink, lineHeight: classicLook ? 18 : 20 },
    topTime: { fontFamily: font, fontSize: classicLook ? 13 : 20, color: colors.ink, lineHeight: classicLook ? 22 : 26, fontWeight: classicLook ? '400' : '700' },
    toggle: {
      flexDirection: 'row',
      backgroundColor: classicLook ? colors.card : 'rgba(255,246,216,0.92)',
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 16,
      overflow: classicLook ? 'visible' : 'hidden',
      minHeight: 48,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 8px 18px rgba(27,18,8,0.12)',
    },
    segment: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
    segmentOn: { backgroundColor: colors.gold },
    segmentText: { fontFamily: font, fontSize: classicLook ? 10 : 15, color: colors.ink, lineHeight: classicLook ? 18 : 20 },
    segmentTextOn: { fontWeight: classicLook ? '400' : '700' },
    title: {
      fontFamily: font,
      fontSize: classicLook ? 16 : 32,
      color: colors.ink,
      textAlign: 'center',
      lineHeight: classicLook ? 28 : 38,
      fontWeight: classicLook ? '400' : '800',
      textShadow: classicLook ? '3px 3px 0 #ffffff' : undefined,
      width: '100%',
    },
    prompt: { fontFamily: font, fontSize: classicLook ? 10 : 15, color: colors.ink, textAlign: 'center', lineHeight: classicLook ? 18 : 22, width: '100%' },
    wait: { fontFamily: font, fontSize: classicLook ? 11 : 16, color: colors.ink, textAlign: 'center', lineHeight: classicLook ? 20 : 24, width: '100%' },
    play: { gap: spacing.md, alignItems: 'center' },
    coinWrap: { alignItems: 'center', marginTop: spacing.sm },
    coin: {
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: colors.gold,
      borderWidth: classicLook ? 6 : 0,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '6px 6px 0 #1b1208' : '0 10px 24px rgba(224,154,18,0.45)',
    },
    coinInner: {
      width: 82,
      height: 82,
      borderRadius: 41,
      borderWidth: classicLook ? 4 : 3,
      borderColor: colors.goldDeep,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffe56a',
    },
    coinText: { fontFamily: font, fontSize: classicLook ? 11 : 14, color: colors.ink, lineHeight: classicLook ? 18 : 18, textAlign: 'center', fontWeight: classicLook ? '400' : '800' },
    hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
    card: {
      alignSelf: 'stretch',
      backgroundColor: colors.card,
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 20,
      padding: spacing.md,
      gap: spacing.md,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 10px 24px rgba(27,18,8,0.12)',
    },
    toss: {
      minHeight: 48,
      backgroundColor: colors.gold,
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 8px 16px rgba(27,18,8,0.12)',
    },
    tossText: { fontFamily: font, fontSize: classicLook ? 12 : 16, color: colors.ink, lineHeight: classicLook ? 20 : 22, fontWeight: classicLook ? '400' : '700' },
    sign: {
      alignSelf: 'stretch',
      backgroundColor: classicLook ? '#e0a45a' : colors.card,
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 20,
      padding: spacing.md,
      gap: spacing.sm,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 10px 24px rgba(27,18,8,0.12)',
    },
    signTitle: { fontFamily: font, fontSize: classicLook ? 12 : 16, color: colors.ink, lineHeight: classicLook ? 20 : 22, fontWeight: classicLook ? '400' : '700' },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
    barLabel: { fontFamily: font, fontSize: classicLook ? 10 : 14, color: colors.ink, width: classicLook ? 78 : 64, lineHeight: classicLook ? 16 : 18 },
    barTrack: {
      flex: 1,
      height: classicLook ? 18 : 12,
      backgroundColor: '#fff6d8',
      borderWidth: classicLook ? 3 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 999,
      overflow: 'hidden',
    },
    barFill: { height: '100%' },
    barValue: { fontFamily: font, fontSize: classicLook ? 12 : 16, color: colors.ink, width: 36, textAlign: 'right', lineHeight: classicLook ? 18 : 20 },
    grass: { height: 56, zIndex: 2 },
    grassTop: { height: 16, backgroundColor: colors.grass, borderTopWidth: classicLook ? 4 : 0, borderTopColor: colors.ink },
    dirt: { flex: 1, backgroundColor: colors.dirt, borderTopWidth: classicLook ? 4 : 0, borderTopColor: '#8a5a22' },
  });
}

const classic = sheet('classic');
const modern = sheet('modern');
