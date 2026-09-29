import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PublicRunState, WsClientMessage } from '../../../shared/events';
import { colors, spacing } from '../theme';
import { Body, Button, Card, Label, ProgressBar, Title } from '../components/ui';
import { ChallengeCard } from '../components/ChallengeCard';

interface Props {
  run: PublicRunState;
  quizResult: { runId: string; correct: boolean } | null;
  send: (msg: WsClientMessage) => void;
  onDismiss: () => void;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function RunScreen({ run, quizResult, send, onDismiss }: Props) {
  const done = run.status === 'done';
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done]);

  const elapsed = ((done ? run.endedAt ?? now : now) - run.startedAt) / 1000;
  const fraction = elapsed / Math.max(1, run.predictedSeconds);
  const remaining = run.predictedSeconds - elapsed;
  const files = run.editedFiles.length;

  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Label>{done ? 'Agent done' : 'Agent working'}</Label>
        <Title>{done ? `Back in ${fmt(elapsed)}` : remaining > 0 ? `~${fmt(remaining)} left` : 'Any second now'}</Title>
        <Text style={styles.prompt} numberOfLines={2}>
          {run.prompt || '(no prompt text)'}
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <ProgressBar fraction={done ? 1 : fraction} />
        <View style={styles.meta}>
          <Text style={styles.metaText}>{fmt(elapsed)} elapsed</Text>
          <Text style={styles.metaText}>predicted {fmt(run.predictedSeconds)}</Text>
        </View>
        <Text style={styles.note}>
          {run.progressNote ??
            (run.toolCalls === 0 ? 'Agent is thinking' : `${run.toolCalls} tool call${run.toolCalls === 1 ? '' : 's'}`)}
          {files > 0 ? ` · ${files} file${files === 1 ? '' : 's'} touched` : ''}
        </Text>
      </Card>

      {done && (
        <Card style={styles.doneCard}>
          <Label>What changed</Label>
          <Body>{run.doneSummary ?? 'Summarising…'}</Body>
          {files > 0 && (
            <Text style={styles.files} numberOfLines={4}>
              {run.editedFiles.map((f) => f.split('/').pop()).join(' · ')}
            </Text>
          )}
          <Button label="Back to the diff" onPress={onDismiss} />
        </Card>
      )}

      <Card>
        <ChallengeCard
          run={run}
          quizResult={quizResult}
          send={send}
          onFinished={() => undefined}
          look="classic"
          locked={run.status === 'done'}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  prompt: { color: colors.muted, fontSize: 14, marginTop: spacing.xs },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: colors.muted, fontSize: 13 },
  note: { color: colors.text, fontSize: 15 },
  doneCard: { borderColor: colors.success, gap: spacing.md },
  files: { color: colors.muted, fontSize: 13 },
});
