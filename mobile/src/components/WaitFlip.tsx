import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { PublicRunState, TodayBoard } from '../../../shared/events';
import { elapsedSeconds, playSession, sinceStopSeconds, type PlayPhase } from '../../../shared/session';
import type { useRelay } from '../useRelay';
import { getClientId, type Look } from '../storage';
import { colors, future, futureFont, pixel, spacing } from '../theme';
import { ChallengeCard } from './ChallengeCard';

type Relay = ReturnType<typeof useRelay>;

/** Matches the coin's flight so the challenge appears as it lands. */
const TOSS_MS = 1600;

function fmt(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function useClock(running: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

function hintFor(look: Look, session: PlayPhase, run: PublicRunState | null, elapsed: number): string {
  if (!run || session === 'idle') return '';
  if (session === 'stopped') return look === 'modern' ? 'AGENT STOPPED' : 'stopped';
  const past = elapsed > run.predictedSeconds;
  if (look === 'modern') return past ? 'PAST ESTIMATE  ·  STILL LIVE' : `EST ${fmt(run.predictedSeconds)}`;
  return past ? 'past est' : `est ${fmt(run.predictedSeconds)}`;
}

function agentLabel(look: Look, session: PlayPhase, count: number): string {
  if (session === 'stopped') return look === 'modern' ? 'RAN' : 'Ran';
  if (session !== 'live') return look === 'modern' ? 'STANDBY' : 'Idle';
  if (look === 'modern') return count === 1 ? '1 AGENT' : `${count} AGENTS`;
  return count === 1 ? '1 live' : `${count} live`;
}

function Runtime({
  run,
  look,
  session,
  elapsed,
  sinceStop,
  flash,
}: {
  run: PublicRunState | null;
  look: Look;
  session: PlayPhase;
  elapsed: number;
  sinceStop: number;
  flash: boolean;
}) {
  const s = look === 'modern' ? futureStyles : classic;
  const now = Date.now();
  const wave = (Math.sin(now / 220) + 1) / 2;
  const clock = session === 'idle' ? '--:--' : fmt(elapsed);
  const count = run?.activeAgents ?? (session === 'live' ? 1 : 0);
  const dot =
    flash ? future.magenta : session === 'stopped' ? future.muted : session === 'live' ? future.cyan : future.muted;
  return (
    <View
      style={[s.topBar, session === 'live' ? s.topBarLive : s.topBarIdle, flash && s.topBarFlash]}
      testID="runtime-bar"
    >
      <View style={s.liveRow}>
        {look === 'modern' ? (
          <View style={[s.pulse, { backgroundColor: dot, opacity: session === 'live' ? 0.4 + wave * 0.6 : 1 }]} />
        ) : null}
        <Text testID="agent-count" style={[s.topLabel, session !== 'live' && s.topLabelIdle]}>
          {agentLabel(look, session, count)}
        </Text>
      </View>
      <View style={s.clocks}>
        <Text testID="runtime" style={s.topTime}>
          {clock}
        </Text>
        {session === 'stopped' ? (
          <Text testID="since-stop" style={s.since}>
            {look === 'modern' ? `SINCE ${fmt(sinceStop)}` : `+${fmt(sinceStop)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Coin({
  phase,
  spinKey,
  face,
  look,
  dimmed,
  canToss,
  onToss,
}: {
  phase: 'idle' | 'spin' | 'landed';
  spinKey: string;
  face: 'physical' | 'quiz' | null;
  look: Look;
  dimmed: boolean;
  canToss: boolean;
  onToss: () => void;
}) {
  const s = look === 'modern' ? futureStyles : classic;
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'spin') {
      turn.setValue(0);
      return;
    }
    turn.setValue(0);
    const flight = Animated.timing(turn, {
      toValue: 1,
      duration: TOSS_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    flight.start();
    return () => flight.stop();
  }, [phase, spinKey, turn]);

  const rotateY = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1800deg'] });
  const rotateYBack = turn.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '1980deg'] });
  const translateY = turn.interpolate({ inputRange: [0, 0.2, 0.55, 1], outputRange: [0, -24, -92, 0] });
  const rotateX = turn.interpolate({ inputRange: [0, 0.22, 0.7, 1], outputRange: ['0deg', '24deg', '12deg', '0deg'] });
  const landed = face === 'quiz' ? 'TRIVIA' : 'MOVE';
  const front = phase === 'landed' ? landed : phase === 'spin' ? 'MOVE' : 'FLIP';
  const back = phase === 'spin' ? 'TRIVIA' : front;

  return (
    <Pressable
      testID={canToss ? 'toss-again' : 'coin-press'}
      disabled={!canToss}
      onPress={onToss}
      style={s.coinWrap}
    >
      <Text testID="coin-phase" style={s.hidden}>
        {phase === 'idle' ? 'idle' : phase}
      </Text>
      {look === 'modern' ? <View pointerEvents="none" style={s.coinHalo} /> : null}
      <Animated.View style={{ transform: [{ translateY }, { rotateX }] }}>
        <View>
          <Animated.View
            testID="coin"
            style={[s.coin, canToss && s.coinReady, dimmed && s.coinDim, { transform: [{ rotateY }], backfaceVisibility: 'hidden' }]}
          >
            <View style={s.coinInner}>
              <Text testID="coin-face" style={s.coinText}>
                {front}
              </Text>
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[s.coin, s.coinBackFace, dimmed && s.coinDim, { transform: [{ rotateY: rotateYBack }], backfaceVisibility: 'hidden' }]}
          >
            <View style={s.coinInner}>
              <Text style={s.coinText}>{back}</Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
      <Text testID="outcome" style={s.hidden}>
        {phase === 'landed' ? (face === 'quiz' ? 'quiz' : 'physical') : 'spinning'}
      </Text>
    </Pressable>
  );
}

function Chart({ today, look }: { today: TodayBoard; look: Look }) {
  const s = look === 'modern' ? futureStyles : classic;
  const max = Math.max(1, today.physical, today.trivia);
  return (
    <View testID="chart" style={s.sign}>
      <Text style={s.signTitle}>{look === 'modern' ? 'TODAY' : 'Today'}</Text>
      <Bar look={look} testID="chart-physical" label="Move" value={today.physical} max={max} color={look === 'modern' ? future.cyan : '#7CFF6B'} />
      <Bar look={look} testID="chart-trivia" label="Trivia" value={today.trivia} max={max} color={look === 'modern' ? future.magenta : colors.gold} />
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
  const s = look === 'modern' ? futureStyles : classic;
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
  const s = look === 'modern' ? futureStyles : classic;
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

function FutureAtmosphere() {
  return (
    <View pointerEvents="none" style={atmo.layer}>
      <View style={atmo.orbA} />
      <View style={atmo.orbB} />
      <View style={atmo.ring} />
      <View style={atmo.ring2} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[atmo.line, { top: 88 + i * 92 }]} />
      ))}
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
  const s = look === 'modern' ? futureStyles : classic;
  const { run, quizResult, today, send } = relay;
  const session = playSession(run?.status);
  const now = useClock(session !== 'idle');
  const elapsed = run ? elapsedSeconds(run, now) : 0;
  const sinceStop = run ? sinceStopSeconds(run, now) : 0;
  const locked = session === 'stopped';
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!run?.agentPulse) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [run?.runId, run?.agentPulse]);
  const [spin, setSpin] = useState<'idle' | 'spin' | 'landed'>('idle');
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const seq = run?.challengeSeq ?? 0;
  const challengeKey = `${run?.runId ?? ''}:${seq}`;

  useEffect(() => {
    if (!run || run.status !== 'running') {
      setSpin(run ? 'landed' : 'idle');
      return;
    }
    setSpin('spin');
    const timer = setTimeout(() => setSpin('landed'), TOSS_MS);
    return () => clearTimeout(timer);
  }, [run?.runId, run?.challengeSeq, run?.status]);

  const face: 'physical' | 'quiz' | null =
    run?.coin === 'quiz' || run?.challenge?.kind === 'quiz'
      ? 'quiz'
      : run?.coin === 'physical' || run?.challenge?.kind === 'physical'
        ? 'physical'
        : null;
  const showChallenge = !!run?.challenge && spin === 'landed';
  const finished = doneKey === challengeKey && spin === 'landed' && session === 'live';
  const toss = () => {
    if (!finished) return;
    send({ type: 'flip', clientId: getClientId() });
  };

  return (
    <View style={s.sky} testID="screen" {...({ dataSet: { look } } as object)}>
      <Text testID="session-phase" style={s.hidden}>
        {session}
      </Text>
      {look === 'classic' ? (
        <View pointerEvents="none" style={s.cloudLayer}>
          <Cloud top={18} left={8} />
          <Cloud top={108} right={6} scale={0.72} />
          <Cloud top={168} left={28} scale={0.55} />
        </View>
      ) : (
        <FutureAtmosphere />
      )}
      <View style={s.column}>
        <View style={s.header}>
          <Runtime run={run} look={look} session={session} elapsed={elapsed} sinceStop={sinceStop} flash={flash} />
          {session === 'live' && run?.agentNote ? (
            <Text testID="agent-notice" style={[s.notice, flash && s.noticeOn]}>
              {run.agentNote}
            </Text>
          ) : null}
          <Text testID="estimate" style={hintFor(look, session, run, elapsed) ? s.hint : s.hidden}>
            {hintFor(look, session, run, elapsed)}
          </Text>
          {look === 'modern' && run && session === 'live' ? (
            <View style={s.meter} testID="estimate-meter">
              <View
                style={[
                  s.meterFill,
                  {
                    width: `${Math.min(100, (elapsed / Math.max(1, run.predictedSeconds)) * 100)}%`,
                    backgroundColor: elapsed > run.predictedSeconds ? future.amber : future.cyan,
                  },
                ]}
              />
            </View>
          ) : null}
          <ThemeToggle look={look} onLook={onLook} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} testID="scroller">
          {look === 'modern' ? <Text style={s.eyebrow}>CURSOR  ·  WAIT WINDOW</Text> : null}
          <Text testID="title" style={[s.title, titleGlow(look)]}>{look === 'classic' ? 'WAIT FLIP' : 'Wait Flip'}</Text>
          {run?.prompt ? (
            <Text testID="prompt" style={s.prompt}>
              {run.prompt}
            </Text>
          ) : null}
          {!run ? (
            <View style={s.play}>
              {look === 'modern' ? (
                <Coin phase="idle" spinKey="idle" face={null} look={look} dimmed={false} canToss={false} onToss={() => undefined} />
              ) : null}
              <Text testID="waiting" style={s.wait}>
                {look === 'modern' ? 'LINK READY  ·  WAITING FOR A PROMPT' : 'Waiting for the agent to take off'}
              </Text>
            </View>
          ) : (
            <View style={s.play}>
              <Coin
                phase={spin === 'idle' ? 'spin' : spin}
                spinKey={`${challengeKey}:${spin}`}
                face={face}
                look={look}
                dimmed={locked}
                canToss={finished}
                onToss={toss}
              />
              {finished ? (
                <Text testID="toss-hint" style={s.wait}>
                  {look === 'modern' ? 'TAP THE COIN' : 'Tap the coin'}
                </Text>
              ) : null}
              {showChallenge ? (
                <View style={s.card}>
                  <ChallengeCard
                    key={challengeKey}
                    run={run}
                    quizResult={quizResult}
                    send={send}
                    onFinished={() => setDoneKey(challengeKey)}
                    look={look}
                    locked={locked}
                  />
                  {locked ? (
                    <View testID="agent-stopped" style={s.stopped}>
                      <Text style={s.stoppedKicker}>{look === 'modern' ? 'SESSION CLOSED' : 'Agent stopped'}</Text>
                      <Text style={s.stoppedBody}>{run.doneSummary ?? 'Head back to the diff.'}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={s.wait}>
                  {locked ? 'Agent stopped' : spin === 'landed' ? 'Catching the challenge' : look === 'modern' ? 'COIN IN FLIGHT' : 'The coin is in the air'}
                </Text>
              )}
            </View>
          )}
          <Chart today={today} look={look} />
        </ScrollView>
      </View>
      {look === 'classic' ? (
        <View testID="grass" style={s.grass}>
          <View style={s.grassTop} />
          <View style={s.dirt} />
        </View>
      ) : (
        <View testID="horizon" style={s.horizon} />
      )}
    </View>
  );
}

/** Overlapping bumps with one shared outline, so the sky decoration is a cloud. */
function Cloud({
  top,
  left,
  right,
  scale = 1,
}: {
  top: number;
  left?: number;
  right?: number;
  scale?: number;
}) {
  const bumps = [
    { left: 8, bottom: 16, size: 46 },
    { left: 34, bottom: 28, size: 58 },
    { left: 78, bottom: 18, size: 42 },
    { left: 18, bottom: 2, size: 96, height: 38 },
  ];
  return (
    <View pointerEvents="none" style={[cloudStyles.cluster, { top, left, right, transform: [{ scale }] }]}>
      {bumps.map((bump, index) => (
        <View
          key={`ink-${index}`}
          style={{
            position: 'absolute',
            left: bump.left - 3,
            bottom: bump.bottom - 3,
            width: bump.size + 6,
            height: (bump.height ?? bump.size) + 6,
            borderRadius: 999,
            backgroundColor: colors.ink,
          }}
        />
      ))}
      {bumps.map((bump, index) => (
        <View
          key={`fill-${index}`}
          style={{
            position: 'absolute',
            left: bump.left,
            bottom: bump.bottom,
            width: bump.size,
            height: bump.height ?? bump.size,
            borderRadius: 999,
            backgroundColor: colors.cloud,
          }}
        />
      ))}
    </View>
  );
}

const cloudStyles = StyleSheet.create({
  cluster: { position: 'absolute', width: 140, height: 96 },
});

const atmo = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'hidden' },
  orbA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -40,
    right: -70,
    backgroundColor: 'rgba(28, 92, 140, 0.45)',
  },
  orbB: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: 40,
    left: -80,
    backgroundColor: 'rgba(92, 24, 88, 0.35)',
  },
  ring: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: 168,
    left: '50%',
    marginLeft: -170,
    borderWidth: 1,
    borderColor: 'rgba(94, 242, 255, 0.16)',
  },
  ring2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 228,
    left: '50%',
    marginLeft: -110,
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 216, 0.2)',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(94, 242, 255, 0.08)',
  },
});

function titleGlow(look: Look): TextStyle {
  return (
    look === 'classic'
      ? { textShadow: '3px 3px 0 #ffffff' }
      : { textShadow: '0 0 22px rgba(94,242,255,0.55)' }
  ) as TextStyle;
}

function sheet(look: Look) {
  const classicLook = look === 'classic';
  const font = classicLook ? pixel : futureFont;
  const ink = classicLook ? colors.ink : future.text;
  const panel = classicLook ? colors.card : future.panel;
  const line = classicLook ? colors.ink : future.line;
  return StyleSheet.create({
    sky: { flex: 1, backgroundColor: classicLook ? colors.sky : future.void },
    cloudLayer: { ...StyleSheet.absoluteFill, zIndex: 0 },
    column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', zIndex: 1 },
    header: { paddingHorizontal: 12, paddingTop: 8, gap: 8, zIndex: 2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36, gap: spacing.md },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: panel,
      borderWidth: classicLook ? 4 : 1,
      borderColor: line,
      borderRadius: classicLook ? 0 : 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      minHeight: 52,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 0 24px rgba(94,242,255,0.12)',
    },
    topBarLive: {
      backgroundColor: classicLook ? '#ffe56a' : '#123044',
      borderColor: classicLook ? colors.ink : future.cyan,
    },
    topBarIdle: {
      backgroundColor: classicLook ? colors.card : 'rgba(8,16,32,0.72)',
      borderColor: classicLook ? colors.ink : 'rgba(142,166,194,0.35)',
    },
    topBarFlash: {
      backgroundColor: classicLook ? '#ffb4a8' : 'rgba(255,79,216,0.42)',
      borderColor: classicLook ? colors.ink : future.magenta,
    },
    topLabelIdle: { color: classicLook ? colors.muted : future.muted },
    notice: {
      fontFamily: font,
      fontSize: classicLook ? 9 : 12,
      color: classicLook ? colors.ink : future.magenta,
      lineHeight: classicLook ? 16 : 18,
      textAlign: 'center',
    },
    noticeOn: { color: classicLook ? colors.ink : '#ffe56a' },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pulse: { width: 8, height: 8, borderRadius: 4, boxShadow: '0 0 10px rgba(94,242,255,0.8)' },
    topLabel: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 11,
      color: classicLook ? colors.ink : future.cyan,
      lineHeight: classicLook ? 18 : 16,
      letterSpacing: classicLook ? 0 : 1.8,
    },
    topTime: {
      fontFamily: font,
      fontSize: classicLook ? 13 : 22,
      color: ink,
      lineHeight: classicLook ? 22 : 26,
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 1,
    },
    clocks: { alignItems: 'flex-end', justifyContent: 'center' },
    since: {
      fontFamily: font,
      fontSize: classicLook ? 9 : 11,
      color: classicLook ? colors.ink : future.magenta,
      lineHeight: classicLook ? 16 : 16,
      letterSpacing: classicLook ? 0 : 1.2,
    },
    hint: {
      fontFamily: font,
      fontSize: classicLook ? 9 : 11,
      color: classicLook ? colors.ink : future.amber,
      lineHeight: classicLook ? 16 : 16,
      letterSpacing: classicLook ? 0 : 1.4,
      minHeight: classicLook ? 16 : 16,
      textAlign: classicLook ? 'left' : 'right',
    },
    meter: {
      height: 3,
      borderRadius: 99,
      backgroundColor: 'rgba(94,242,255,0.12)',
      overflow: 'hidden',
    },
    meterFill: { height: 3, borderRadius: 99 },
    toggle: {
      flexDirection: 'row',
      backgroundColor: classicLook ? colors.card : 'rgba(8,16,32,0.72)',
      borderWidth: classicLook ? 4 : 1,
      borderColor: line,
      borderRadius: classicLook ? 0 : 14,
      overflow: classicLook ? 'visible' : 'hidden',
      minHeight: 48,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 0 18px rgba(94,242,255,0.08)',
    },
    segment: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
    segmentOn: { backgroundColor: classicLook ? colors.gold : future.cyan },
    segmentText: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 12,
      color: classicLook ? colors.ink : future.muted,
      lineHeight: classicLook ? 18 : 16,
      letterSpacing: classicLook ? 0 : 1.2,
    },
    segmentTextOn: { color: classicLook ? colors.ink : future.void, fontWeight: classicLook ? '400' : '700' },
    eyebrow: {
      fontFamily: font,
      fontSize: 11,
      color: future.cyan,
      textAlign: 'center',
      letterSpacing: 3,
      lineHeight: 16,
    },
    title: {
      fontFamily: font,
      fontSize: classicLook ? 16 : 34,
      color: ink,
      textAlign: 'center',
      lineHeight: classicLook ? 28 : 42,
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 2,
      textTransform: classicLook ? 'none' : 'uppercase',
      width: '100%',
    },
    prompt: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 14,
      color: classicLook ? colors.ink : future.text,
      textAlign: classicLook ? 'center' : 'left',
      lineHeight: classicLook ? 18 : 22,
      width: '100%',
      paddingHorizontal: classicLook ? 0 : 4,
    },
    wait: {
      fontFamily: font,
      fontSize: classicLook ? 11 : 13,
      color: classicLook ? colors.ink : future.muted,
      textAlign: 'center',
      lineHeight: classicLook ? 20 : 20,
      letterSpacing: classicLook ? 0 : 1.4,
      width: '100%',
    },
    play: { gap: spacing.md, alignItems: 'center' },
    coinWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      width: classicLook ? 140 : 168,
      height: classicLook ? 140 : 168,
    },
    coinHalo: {
      position: 'absolute',
      width: 168,
      height: 168,
      borderRadius: 84,
      borderWidth: 1,
      borderColor: 'rgba(94,242,255,0.35)',
      boxShadow: '0 0 36px rgba(94,242,255,0.2)',
    },
    coinBackFace: { position: 'absolute', top: 0, left: 0 },
    coinReady: {
      borderColor: classicLook ? colors.goldDeep : future.magenta,
      boxShadow: classicLook ? '6px 6px 0 #1b1208' : '0 0 28px rgba(255,79,216,0.55)',
    },
    coin: {
      width: classicLook ? 116 : 128,
      height: classicLook ? 116 : 128,
      borderRadius: classicLook ? 58 : 64,
      backgroundColor: classicLook ? colors.gold : future.panelSolid,
      borderWidth: classicLook ? 6 : 1,
      borderColor: classicLook ? colors.ink : future.cyan,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '6px 6px 0 #1b1208' : '0 0 32px rgba(94,242,255,0.28)',
    },
    coinDim: { opacity: 0.55 },
    coinInner: {
      width: classicLook ? 82 : 92,
      height: classicLook ? 82 : 92,
      borderRadius: classicLook ? 41 : 46,
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.goldDeep : future.magenta,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: classicLook ? '#ffe56a' : 'rgba(8, 18, 36, 0.95)',
    },
    coinText: {
      fontFamily: font,
      fontSize: classicLook ? 11 : 16,
      color: classicLook ? colors.ink : future.cyan,
      lineHeight: classicLook ? 18 : 22,
      textAlign: 'center',
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 2,
    },
    hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
    card: {
      alignSelf: 'stretch',
      backgroundColor: panel,
      borderWidth: classicLook ? 4 : 1,
      borderColor: line,
      borderTopWidth: classicLook ? 4 : 2,
      borderTopColor: classicLook ? colors.ink : future.cyan,
      borderRadius: classicLook ? 0 : 18,
      padding: spacing.md,
      gap: spacing.md,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 16px 40px rgba(0,0,0,0.35)',
    },
    toss: {
      minHeight: 48,
      backgroundColor: classicLook ? colors.gold : 'transparent',
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.ink : future.magenta,
      borderRadius: classicLook ? 0 : 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 0 16px rgba(255,79,216,0.2)',
    },
    tossText: {
      fontFamily: font,
      fontSize: classicLook ? 12 : 13,
      color: classicLook ? colors.ink : future.magenta,
      lineHeight: classicLook ? 20 : 18,
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 1.6,
    },
    stopped: {
      gap: 6,
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.ink : future.magenta,
      borderRadius: classicLook ? 0 : 12,
      padding: 12,
      backgroundColor: classicLook ? '#fff6d8' : 'rgba(255,79,216,0.08)',
    },
    stoppedKicker: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 11,
      color: classicLook ? colors.ink : future.magenta,
      lineHeight: classicLook ? 18 : 16,
      letterSpacing: classicLook ? 0 : 1.8,
    },
    stoppedBody: { fontFamily: font, fontSize: classicLook ? 10 : 14, color: ink, lineHeight: classicLook ? 18 : 20 },
    sign: {
      alignSelf: 'stretch',
      backgroundColor: classicLook ? '#e0a45a' : future.panel,
      borderWidth: classicLook ? 4 : 1,
      borderColor: line,
      borderRadius: classicLook ? 0 : 18,
      padding: spacing.md,
      gap: spacing.sm,
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 12px 32px rgba(0,0,0,0.28)',
    },
    signTitle: {
      fontFamily: font,
      fontSize: classicLook ? 12 : 12,
      color: classicLook ? colors.ink : future.cyan,
      lineHeight: classicLook ? 20 : 16,
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 2.2,
    },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
    barLabel: { fontFamily: font, fontSize: classicLook ? 10 : 12, color: ink, width: classicLook ? 78 : 64, lineHeight: classicLook ? 16 : 16 },
    barTrack: {
      flex: 1,
      height: classicLook ? 18 : 8,
      backgroundColor: classicLook ? '#fff6d8' : 'rgba(255,255,255,0.06)',
      borderWidth: classicLook ? 3 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 999,
      overflow: 'hidden',
    },
    barFill: { height: '100%', boxShadow: classicLook ? undefined : '0 0 10px rgba(94,242,255,0.45)' },
    barValue: { fontFamily: font, fontSize: classicLook ? 12 : 14, color: ink, width: 36, textAlign: 'right', lineHeight: classicLook ? 18 : 18 },
    grass: { height: 56, zIndex: 2 },
    grassTop: { height: 16, backgroundColor: colors.grass, borderTopWidth: classicLook ? 4 : 0, borderTopColor: colors.ink },
    dirt: { flex: 1, backgroundColor: colors.dirt, borderTopWidth: classicLook ? 4 : 0, borderTopColor: '#8a5a22' },
    horizon: {
      height: 36,
      zIndex: 2,
      borderTopWidth: 1,
      borderTopColor: 'rgba(94,242,255,0.55)',
      boxShadow: '0 -18px 40px rgba(94,242,255,0.18)',
    },
  });
}

const classic = sheet('classic');
const futureStyles = sheet('modern');
