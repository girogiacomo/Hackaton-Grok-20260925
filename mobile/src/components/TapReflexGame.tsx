import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme';

interface Props {
  /** When true the game freezes and shows the final score. */
  paused: boolean;
}

interface Target {
  id: number;
  x: number;
  y: number;
  bornAt: number;
}

const ARENA_HEIGHT = 320;
const TARGET_SIZE = 64;
/** Targets vanish after this many ms; it shrinks as the score grows. */
const BASE_LIFETIME = 1400;

/**
 * Tap the dot before it disappears. Reaction time is tracked so the score
 * rewards speed, not just persistence. Pauses instantly when the agent stops.
 */
export function TapReflexGame({ paused }: Props) {
  const { width } = useWindowDimensions();
  const arenaWidth = Math.min(width - spacing.lg * 2 - spacing.lg * 2, 420);
  const [target, setTarget] = useState<Target | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawn = () => {
    idRef.current += 1;
    setTarget({
      id: idRef.current,
      x: Math.random() * (arenaWidth - TARGET_SIZE),
      y: Math.random() * (ARENA_HEIGHT - TARGET_SIZE),
      bornAt: Date.now(),
    });
  };

  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (!target) {
      timerRef.current = setTimeout(spawn, 500);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    const lifetime = Math.max(600, BASE_LIFETIME - score * 25);
    timerRef.current = setTimeout(() => {
      setMisses((m) => m + 1);
      setTarget(null);
    }, lifetime);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, paused]);

  const hit = () => {
    if (!target || paused) return;
    const ms = Date.now() - target.bornAt;
    setLastMs(ms);
    setBest((b) => (b === null || ms < b ? ms : b));
    setScore((s) => s + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTarget(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.hud}>
        <Text style={styles.hudValue}>
          {score} <Text style={styles.hudLabel}>hits</Text>
        </Text>
        <Text style={styles.hudValue}>
          {misses} <Text style={styles.hudLabel}>missed</Text>
        </Text>
        <Text style={styles.hudValue}>
          {best ?? '–'} <Text style={styles.hudLabel}>best ms</Text>
        </Text>
      </View>
      <View style={[styles.arena, { width: arenaWidth, height: ARENA_HEIGHT }]}>
        {paused ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Agent finished</Text>
            <Text style={styles.overlayBody}>
              {score} hits, {misses} missed{best !== null ? `, fastest ${best} ms` : ''}
            </Text>
          </View>
        ) : target ? (
          <Pressable
            onPress={hit}
            hitSlop={8}
            style={[styles.target, { left: target.x, top: target.y }]}
          />
        ) : (
          <Text style={styles.hint}>{score === 0 && misses === 0 ? 'Tap the dot before it vanishes' : ''}</Text>
        )}
      </View>
      {lastMs !== null && !paused && <Text style={styles.last}>{lastMs} ms</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  hudValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hudLabel: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  arena: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  target: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  hint: { color: colors.muted },
  last: { color: colors.muted, fontSize: 13 },
  overlay: { alignItems: 'center', gap: spacing.xs, padding: spacing.lg },
  overlayTitle: { color: colors.success, fontWeight: '700', fontSize: 18 },
  overlayBody: { color: colors.text, textAlign: 'center' },
});
