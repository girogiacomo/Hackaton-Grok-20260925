import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicChallenge, PublicRunState, WsClientMessage } from '../../../shared/events';
import { getClientId } from '../storage';
import { colors, pixel, radius, spacing } from '../theme';

interface Props {
  run: PublicRunState;
  quizResult: { runId: string; correct: boolean; answerIndex?: number } | null;
  send: (msg: WsClientMessage) => void;
  onFinished: () => void;
}

export function ChallengeCard({ run, quizResult, send, onFinished }: Props) {
  const challenge = run.challenge;
  if (!challenge) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.loadingText}>Coining a challenge</Text>
      </View>
    );
  }
  if (challenge.kind === 'physical') {
    return <Physical run={run} challenge={challenge} send={send} onFinished={onFinished} />;
  }
  if (challenge.kind === 'quiz') {
    return <Quiz run={run} challenge={challenge} send={send} result={quizResult} onFinished={onFinished} />;
  }
  return null;
}

function Physical({
  run,
  challenge,
  send,
  onFinished,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'physical' }>;
  send: Props['send'];
  onFinished: () => void;
}) {
  const [done, setDone] = useState(false);
  const finish = () => {
    if (done) return;
    setDone(true);
    send({ type: 'physical:done', runId: run.runId, reps: challenge.reps, clientId: getClientId() });
    onFinished();
  };

  return (
    <View style={styles.block}>
      <Text testID="challenge-kind" style={styles.kind}>
        physical
      </Text>
      <Text style={styles.kicker}>Move</Text>
      <Text style={styles.big}>
        {challenge.reps}
        {challenge.unit === 'seconds' ? 's' : 'x'}
      </Text>
      <Text style={styles.exercise}>{challenge.exercise}</Text>
      <Text style={styles.body}>{challenge.motivation}</Text>
      <Pressable testID="challenge-done" onPress={finish} disabled={done} style={styles.done}>
        <Text style={styles.doneText}>{done ? 'Logged' : 'Done'}</Text>
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
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'quiz' }>;
  send: Props['send'];
  result: Props['quizResult'];
  onFinished: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const mine = result && result.runId === run.runId ? result : null;
  const fromAnswer = mine && typeof mine.answerIndex === 'number' ? mine.answerIndex : undefined;
  const fromStop = run.status === 'done' && typeof run.quizAnswerIndex === 'number' ? run.quizAnswerIndex : undefined;
  const revealIndex = fromAnswer ?? fromStop;
  const show = revealIndex !== undefined;

  return (
    <View style={styles.block}>
      <Text testID="challenge-kind" style={styles.kind}>
        quiz
      </Text>
      <Text style={styles.kicker}>Trivia</Text>
      <Text style={styles.question}>{challenge.question}</Text>
      <View style={{ gap: spacing.sm }}>
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
                styles.option,
                isPicked && !show && styles.optionPicked,
                show && isAnswer && styles.optionRight,
                show && isPicked && !isAnswer && styles.optionWrong,
              ]}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {show && run.quizExplanation ? <Text style={styles.body}>{run.quizExplanation}</Text> : null}
      {picked === null && run.status === 'done' ? (
        <Text style={styles.body}>The agent finished first. The answer is lit.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { fontFamily: pixel, fontSize: 10, color: colors.ink, lineHeight: 18 },
  block: { gap: spacing.sm },
  kind: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  kicker: { fontFamily: pixel, fontSize: 10, color: colors.muted, lineHeight: 18 },
  big: { fontFamily: pixel, fontSize: 28, color: colors.ink, lineHeight: 40 },
  exercise: { fontFamily: pixel, fontSize: 14, color: colors.ink, lineHeight: 24 },
  question: { fontFamily: pixel, fontSize: 12, color: colors.ink, lineHeight: 22 },
  body: { fontFamily: pixel, fontSize: 9, color: colors.muted, lineHeight: 16 },
  done: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: '4px 4px 0 #1b1208',
  },
  doneText: { fontFamily: pixel, fontSize: 14, color: colors.ink, lineHeight: 22 },
  option: {
    backgroundColor: '#fff6d8',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 4,
    borderColor: colors.ink,
  },
  optionPicked: { backgroundColor: colors.accent },
  optionRight: { backgroundColor: colors.correct, borderColor: colors.ink },
  optionWrong: { backgroundColor: colors.wrong, borderColor: colors.ink },
  optionText: { fontFamily: pixel, fontSize: 10, color: colors.ink, lineHeight: 18 },
});
