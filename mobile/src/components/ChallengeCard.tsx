import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicChallenge, PublicRunState, WsClientMessage } from '../../../shared/events';
import { getClientId, type Look } from '../storage';
import { colors, modernFont, pixel, spacing } from '../theme';

interface Props {
  run: PublicRunState;
  quizResult: { runId: string; correct: boolean; answerIndex?: number } | null;
  send: (msg: WsClientMessage) => void;
  onFinished: () => void;
  look: Look;
}

export function ChallengeCard({ run, quizResult, send, onFinished, look }: Props) {
  const challenge = run.challenge;
  const s = look === 'modern' ? modern : classic;
  if (!challenge) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.ink} />
        <Text style={s.loadingText}>Coining a challenge</Text>
      </View>
    );
  }
  if (challenge.kind === 'physical') {
    return <Physical run={run} challenge={challenge} send={send} onFinished={onFinished} look={look} />;
  }
  if (challenge.kind === 'quiz') {
    return <Quiz run={run} challenge={challenge} send={send} result={quizResult} onFinished={onFinished} look={look} />;
  }
  return null;
}

function Physical({
  run,
  challenge,
  send,
  onFinished,
  look,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'physical' }>;
  send: Props['send'];
  onFinished: () => void;
  look: Look;
}) {
  const s = look === 'modern' ? modern : classic;
  const [done, setDone] = useState(false);
  const finish = () => {
    if (done) return;
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
      <Pressable testID="challenge-done" onPress={finish} disabled={done} style={s.done}>
        <Text style={s.doneText}>{done ? 'Logged' : 'Done'}</Text>
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
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'quiz' }>;
  send: Props['send'];
  result: Props['quizResult'];
  onFinished: () => void;
  look: Look;
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
              disabled={picked !== null || run.status === 'done'}
              onPress={() => {
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
              <Text style={s.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {show && run.quizExplanation ? <Text style={s.body}>{run.quizExplanation}</Text> : null}
      {picked === null && run.status === 'done' ? (
        <Text style={s.body}>The agent finished first. The answer is lit.</Text>
      ) : null}
    </View>
  );
}

function face(look: Look) {
  const classicLook = look === 'classic';
  const font = classicLook ? pixel : modernFont;
  return StyleSheet.create({
    loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
    loadingText: { fontFamily: font, fontSize: classicLook ? 10 : 15, color: colors.ink, lineHeight: classicLook ? 18 : 22 },
    block: { gap: spacing.sm },
    kind: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    kicker: {
      fontFamily: font,
      fontSize: classicLook ? 10 : 13,
      color: colors.muted,
      lineHeight: classicLook ? 18 : 18,
      letterSpacing: classicLook ? 0 : 0.4,
    },
    big: { fontFamily: font, fontSize: classicLook ? 28 : 40, color: colors.ink, lineHeight: classicLook ? 42 : 48 },
    exercise: { fontFamily: font, fontSize: classicLook ? 13 : 20, color: colors.ink, lineHeight: classicLook ? 22 : 28 },
    question: { fontFamily: font, fontSize: classicLook ? 11 : 17, color: colors.ink, lineHeight: classicLook ? 20 : 24 },
    body: { fontFamily: font, fontSize: classicLook ? 9 : 14, color: colors.muted, lineHeight: classicLook ? 16 : 20 },
    options: { gap: spacing.sm },
    done: {
      marginTop: spacing.sm,
      minHeight: 48,
      backgroundColor: colors.accent,
      borderWidth: classicLook ? 4 : 0,
      borderColor: colors.ink,
      borderRadius: classicLook ? 0 : 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: classicLook ? '4px 4px 0 #1b1208' : '0 8px 16px rgba(27,18,8,0.12)',
    },
    doneText: { fontFamily: font, fontSize: classicLook ? 13 : 16, color: colors.ink, lineHeight: classicLook ? 22 : 22, fontWeight: classicLook ? '400' : '700' },
    option: {
      minHeight: 48,
      backgroundColor: '#fff6d8',
      borderRadius: classicLook ? 0 : 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: classicLook ? 4 : 1,
      borderColor: classicLook ? colors.ink : 'rgba(27,18,8,0.16)',
      justifyContent: 'center',
    },
    optionPicked: { backgroundColor: colors.accent },
    optionRight: { backgroundColor: colors.correct, borderColor: colors.ink },
    optionWrong: { backgroundColor: colors.wrong, borderColor: colors.ink },
    optionText: { fontFamily: font, fontSize: classicLook ? 10 : 15, color: colors.ink, lineHeight: classicLook ? 18 : 22 },
  });
}

const classic = face('classic');
const modern = face('modern');
