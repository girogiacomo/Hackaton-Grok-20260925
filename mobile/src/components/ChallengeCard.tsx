import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicChallenge, PublicRunState, WsClientMessage } from '../../../shared/events';
import { getClientId, type Look } from '../storage';
import { colors, future, futureFont, pixel, spacing } from '../theme';

interface Props {
  run: PublicRunState;
  quizResult: { runId: string; correct: boolean; answerIndex?: number } | null;
  send: (msg: WsClientMessage) => void;
  onFinished: () => void;
  look: Look;
  /** True only after the agent has stopped. The estimate never sets this. */
  locked: boolean;
}

export function ChallengeCard({ run, quizResult, send, onFinished, look, locked }: Props) {
  const challenge = run.challenge;
  const s = look === 'modern' ? modern : classic;
  if (!challenge) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={look === 'modern' ? future.cyan : colors.ink} />
        <Text style={s.loadingText}>Coining a challenge</Text>
      </View>
    );
  }
  if (challenge.kind === 'physical') {
    return <Physical run={run} challenge={challenge} send={send} onFinished={onFinished} look={look} locked={locked} />;
  }
  if (challenge.kind === 'quiz') {
    return <Quiz run={run} challenge={challenge} send={send} result={quizResult} onFinished={onFinished} look={look} locked={locked} />;
  }
  return null;
}

function Physical({
  run,
  challenge,
  send,
  onFinished,
  look,
  locked,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'physical' }>;
  send: Props['send'];
  onFinished: () => void;
  look: Look;
  locked: boolean;
}) {
  const s = look === 'modern' ? modern : classic;
  const [done, setDone] = useState(false);
  const finish = () => {
    if (done || locked) return;
    setDone(true);
    send({ type: 'physical:done', runId: run.runId, reps: challenge.reps, clientId: getClientId() });
    onFinished();
  };

  return (
    <View style={s.block}>
      <Text testID="challenge-kind" style={s.kind}>
        physical
      </Text>
      <Text style={s.kicker}>Move</Text>
      <Text style={s.big}>
        {challenge.reps}
        {challenge.unit === 'seconds' ? 's' : 'x'}
      </Text>
      <Text style={s.exercise}>{challenge.exercise}</Text>
      <Text style={s.body}>{challenge.motivation}</Text>
      <Pressable testID="challenge-done" onPress={finish} disabled={done || locked} style={[s.done, (done || locked) && s.doneOff]}>
        <Text style={s.doneText}>{done ? 'Logged' : locked ? 'Stopped' : 'Done'}</Text>
      </Pressable>
    </View>
  );
}

function Quiz({
  run,
  challenge,
  send,
  result,
  onFinished,
  look,
  locked,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'quiz' }>;
  send: Props['send'];
  result: Props['quizResult'];
  onFinished: () => void;
  look: Look;
  locked: boolean;
}) {
  const s = look === 'modern' ? modern : classic;
  const [picked, setPicked] = useState<number | null>(null);
  const mine = result && result.runId === run.runId ? result : null;
  const fromAnswer = mine && typeof mine.answerIndex === 'number' ? mine.answerIndex : undefined;
  const fromStop = run.status === 'done' && typeof run.quizAnswerIndex === 'number' ? run.quizAnswerIndex : undefined;
  const revealIndex = fromAnswer ?? fromStop;
  const show = revealIndex !== undefined;

  return (
    <View style={s.block}>
      <Text testID="challenge-kind" style={s.kind}>
        quiz
      </Text>
      <Text style={s.kicker}>Trivia</Text>
      <Text style={s.question}>{challenge.question}</Text>
      <View style={s.options}>
        {challenge.options.map((opt, i) => {
          const isPicked = picked === i;
          const isAnswer = revealIndex === i;
          return (
            <Pressable
              key={i}
              testID={`option-${i}`}
              disabled={picked !== null || locked}
              onPress={() => {
                if (picked !== null || locked) return;
                setPicked(i);
                send({ type: 'quiz:answer', runId: run.runId, answerIndex: i, clientId: getClientId() });
                onFinished();
              }}
              style={[
                s.option,
                isPicked && !show && s.optionPicked,
                show && isAnswer && s.optionRight,
                show && isPicked && !isAnswer && s.optionWrong,
              ]}
            >
              {look === 'modern' ? <Text style={s.index}>{String(i + 1).padStart(2, '0')}</Text> : null}
              <Text style={[s.optionText, look === 'modern' && s.optionTextRow]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {show && run.quizExplanation ? <Text style={s.body}>{run.quizExplanation}</Text> : null}
      {picked === null && locked ? (
        <Text style={s.body}>The agent finished first. The answer is lit.</Text>
      ) : null}
    </View>
  );
}

function face(look: Look) {
  const classicLook = look === 'classic';
  const font = classicLook ? pixel : futureFont;
  const ink = classicLook ? colors.ink : future.text;
  const muted = classicLook ? colors.muted : future.muted;
  return StyleSheet.create({
    loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
    loadingText: { fontFamily: font, fontSize: classicLook ? 10 : 13, color: ink, lineHeight: classicLook ? 18 : 20, letterSpacing: classicLook ? 0 : 1.2 },
    block: { gap: spacing.sm },
    kind: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    kicker: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 11,
      color: classicLook ? colors.muted : future.cyan,
      lineHeight: classicLook ? 18 : 16,
      letterSpacing: classicLook ? 0 : 2.4,
    },
    big: {
      fontFamily: font,
      fontSize: classicLook ? 28 : 42,
      color: classicLook ? colors.ink : future.cyan,
      lineHeight: classicLook ? 42 : 50,
    },
    exercise: { fontFamily: font, fontSize: classicLook ? 13 : 18, color: ink, lineHeight: classicLook ? 22 : 26, letterSpacing: classicLook ? 0 : 0.6 },
    question: { fontFamily: font, fontSize: classicLook ? 11 : 16, color: ink, lineHeight: classicLook ? 20 : 24 },
    body: { fontFamily: font, fontSize: classicLook ? 9 : 13, color: muted, lineHeight: classicLook ? 16 : 20 },
    options: { gap: spacing.sm },
    done: {
      marginTop: spacing.sm,
      minHeight: 48,
      backgroundColor: classicLook ? colors.accent : future.cyan,
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.ink : future.cyan,
      borderRadius: classicLook ? 0 : 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 0 22px rgba(94,242,255,0.35)',
    },
    doneOff: { opacity: 0.45 },
    doneText: {
      fontFamily: font,
      fontSize: classicLook ? 13 : 14,
      color: classicLook ? colors.ink : future.void,
      lineHeight: classicLook ? 22 : 20,
      fontWeight: classicLook ? '400' : '700',
      letterSpacing: classicLook ? 0 : 1.6,
    },
    option: {
      minHeight: 48,
      backgroundColor: classicLook ? '#fff6d8' : 'rgba(8, 18, 36, 0.9)',
      borderRadius: classicLook ? 0 : 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.ink : future.line,
      justifyContent: 'center',
      flexDirection: classicLook ? 'column' : 'row',
      alignItems: classicLook ? 'stretch' : 'center',
      gap: classicLook ? 0 : 12,
    },
    index: {
      fontFamily: font,
      fontSize: 12,
      color: future.cyan,
      width: 24,
      lineHeight: 16,
      letterSpacing: 0.5,
    },
    optionPicked: {
      backgroundColor: classicLook ? colors.accent : 'rgba(94,242,255,0.16)',
      borderColor: classicLook ? colors.ink : future.cyan,
    },
    optionRight: {
      backgroundColor: classicLook ? colors.correct : 'rgba(61,255,176,0.16)',
      borderColor: classicLook ? colors.ink : future.good,
    },
    optionWrong: {
      backgroundColor: classicLook ? colors.wrong : 'rgba(255,93,122,0.16)',
      borderColor: classicLook ? colors.ink : future.danger,
    },
    optionText: { fontFamily: font, fontSize: classicLook ? 10 : 14, color: ink, lineHeight: classicLook ? 18 : 20 },
    optionTextRow: { flex: 1 },
  });
}

const classic = face('classic');
const modern = face('modern');
