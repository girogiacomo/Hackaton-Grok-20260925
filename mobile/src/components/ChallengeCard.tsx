import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicChallenge, PublicRunState, WsClientMessage } from '../../../shared/events';
import { colors, radius, spacing } from '../theme';
import { Body, Button, Label } from './ui';
import { TapReflexGame } from './TapReflexGame';

interface Props {
  run: PublicRunState;
  quizResult: { runId: string; correct: boolean } | null;
  send: (msg: WsClientMessage) => void;
}

export function ChallengeCard({ run, quizResult, send }: Props) {
  const challenge = run.challenge;
  const done = run.status === 'done';

  if (!challenge) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Body muted>Picking your sidequest…</Body>
      </View>
    );
  }
  if (challenge.kind === 'physical') return <Physical run={run} challenge={challenge} send={send} done={done} />;
  if (challenge.kind === 'quiz') return <Quiz run={run} challenge={challenge} send={send} result={quizResult} />;
  return (
    <View style={styles.block}>
      <Label>Game</Label>
      <Body muted>{challenge.motivation}</Body>
      <TapReflexGame paused={done} />
    </View>
  );
}

function Physical({
  run,
  challenge,
  send,
  done,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'physical' }>;
  send: Props['send'];
  done: boolean;
}) {
  const [count, setCount] = useState(0);
  const [reported, setReported] = useState(false);
  const isTimed = challenge.unit === 'seconds';
  const [elapsed, setElapsed] = useState(0);
  const [timing, setTiming] = useState(false);

  useEffect(() => {
    if (!timing || done) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [timing, done]);

  const progress = isTimed ? elapsed : count;
  const finished = progress >= challenge.reps;

  useEffect(() => {
    if (finished && !reported) {
      setReported(true);
      send({ type: 'physical:done', runId: run.runId, reps: challenge.reps });
    }
  }, [finished, reported, run.runId, challenge.reps, send]);

  return (
    <View style={styles.block}>
      <Label>Move</Label>
      <Text style={styles.big}>
        {challenge.reps}
        <Text style={styles.unit}> {isTimed ? 's' : 'x'}</Text>
      </Text>
      <Text style={styles.exercise}>{challenge.exercise}</Text>
      <Body muted>{challenge.motivation}</Body>

      {finished ? (
        <Text style={styles.finished}>Done. Reps logged.</Text>
      ) : isTimed ? (
        <View style={styles.row}>
          <Text style={styles.counter}>
            {elapsed}/{challenge.reps}s
          </Text>
          <Button label={timing ? 'Pause' : elapsed ? 'Resume' : 'Start timer'} onPress={() => setTiming((t) => !t)} />
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.counter}>
            {count}/{challenge.reps}
          </Text>
          <Pressable
            onPress={() => setCount((c) => Math.min(challenge.reps, c + 1))}
            style={({ pressed }) => [styles.tap, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.tapText}>+1</Text>
          </Pressable>
          <Pressable onPress={() => setCount((c) => Math.min(challenge.reps, c + 5))} style={styles.tapSmall}>
            <Text style={styles.tapSmallText}>+5</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Quiz({
  run,
  challenge,
  send,
  result,
}: {
  run: PublicRunState;
  challenge: Extract<PublicChallenge, { kind: 'quiz' }>;
  send: Props['send'];
  result: Props['quizResult'];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = run.status === 'done' && typeof run.quizAnswerIndex === 'number';
  const answerIndex = revealed ? run.quizAnswerIndex : undefined;
  const answered = picked !== null;
  const myResult = result && result.runId === run.runId ? result.correct : null;

  return (
    <View style={styles.block}>
      <Label>Quiz</Label>
      <Text style={styles.question}>{challenge.question}</Text>
      <View style={{ gap: spacing.sm }}>
        {challenge.options.map((opt, i) => {
          const isPicked = picked === i;
          const isAnswer = answerIndex === i;
          return (
            <Pressable
              key={i}
              disabled={answered}
              onPress={() => {
                setPicked(i);
                send({ type: 'quiz:answer', runId: run.runId, answerIndex: i });
              }}
              style={[
                styles.option,
                isPicked && styles.optionPicked,
                isPicked && myResult === true && styles.optionRight,
                isPicked && myResult === false && styles.optionWrong,
                revealed && isAnswer && styles.optionRight,
              ]}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && myResult !== null && (
        <Text style={[styles.verdict, { color: myResult ? colors.success : colors.danger }]}>
          {myResult ? 'Correct.' : 'Not quite.'}
          {revealed ? '' : ' Explanation lands when the agent finishes.'}
        </Text>
      )}
      {revealed && run.quizExplanation ? <Body muted>{run.quizExplanation}</Body> : null}
      {!answered && run.status === 'done' && <Body muted>Agent finished before you answered. Next time.</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  block: { gap: spacing.sm },
  big: { color: colors.text, fontSize: 64, fontWeight: '800', lineHeight: 70 },
  unit: { color: colors.muted, fontSize: 28, fontWeight: '600' },
  exercise: { color: colors.text, fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  counter: { color: colors.text, fontSize: 22, fontWeight: '700', minWidth: 80 },
  tap: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
  },
  tapText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  tapSmall: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tapSmallText: { color: colors.text, fontWeight: '700' },
  finished: { color: colors.success, fontWeight: '700', marginTop: spacing.sm },
  question: { color: colors.text, fontSize: 20, fontWeight: '600', lineHeight: 26 },
  option: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPicked: { borderColor: colors.accent },
  optionRight: { borderColor: colors.success, backgroundColor: '#14352a' },
  optionWrong: { borderColor: colors.danger, backgroundColor: '#3a1f1f' },
  optionText: { color: colors.text, fontSize: 16 },
  verdict: { fontWeight: '700' },
});
