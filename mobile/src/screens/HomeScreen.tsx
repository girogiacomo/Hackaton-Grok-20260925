import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChallengeMode, Stats, WsClientMessage } from '../../../shared/events';
import { colors, spacing } from '../theme';
import { Body, Button, Card, Label, Pill, StatRow, Title } from '../components/ui';
import type { ConnectionStatus } from '../useRelay';
import type { Pairing } from '../storage';

interface Props {
  status: ConnectionStatus;
  pairing: Pairing;
  stats: Stats | null;
  mode: ChallengeMode;
  send: (msg: WsClientMessage) => void;
  onUnpair: () => void;
}

const MODES: { id: ChallengeMode; label: string; blurb: string }[] = [
  { id: 'mixed', label: 'Mixed', blurb: 'Rotate between moving, thinking and playing.' },
  { id: 'physical', label: 'Move', blurb: 'Squats, planks, a walk. Reps scale with the predicted wait.' },
  { id: 'quiz', label: 'Quiz', blurb: 'One Grok question about what the agent is building.' },
  { id: 'game', label: 'Game', blurb: 'Tap-reflex, freezes the instant the agent finishes.' },
];

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting to relay…',
  open: 'Listening for Cursor',
  closed: 'Relay unreachable, retrying',
  rejected: 'Pairing code rejected',
};

export function HomeScreen({ status, pairing, stats, mode, send, onUnpair }: Props) {
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Label>Sidequest</Label>
        <Title>Waiting for your next prompt</Title>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: status === 'open' ? colors.success : status === 'connecting' ? colors.warning : colors.danger },
            ]}
          />
          <Text style={styles.status}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      <Card>
        <Label>Challenge mode</Label>
        <View style={styles.pills}>
          {MODES.map((m) => (
            <Pill key={m.id} active={m.id === mode} onPress={() => send({ type: 'mode', mode: m.id })}>
              {m.label}
            </Pill>
          ))}
        </View>
        <Body muted>{current.blurb}</Body>
      </Card>

      <Card>
        <Label>Reclaimed</Label>
        <StatRow
          items={[
            { label: 'runs', value: stats?.runs ?? 0 },
            { label: 'minutes', value: stats?.minutesReclaimed ?? 0 },
            { label: 'reps', value: stats?.repsDone ?? 0 },
            {
              label: 'quiz',
              value: stats ? `${stats.quizzesRight}/${stats.quizzesAnswered}` : '0/0',
            },
          ]}
        />
      </Card>

      <Card>
        <Label>Relay</Label>
        <Body>{pairing.url}</Body>
        <Button label="Unpair" variant="ghost" onPress={onUnpair} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { color: colors.muted, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
