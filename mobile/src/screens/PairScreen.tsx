import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, spacing } from '../theme';
import { Body, Button, Card, Label, Title } from '../components/ui';
import { normaliseUrl, type Pairing } from '../storage';
import { getPushToken } from '../notifications';

interface Props {
  onPaired: (pairing: Pairing) => void;
}

async function pair(pairing: Pairing): Promise<string | null> {
  const pushToken = await getPushToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${pairing.url}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pairing.code, pushToken }),
      signal: controller.signal,
    });
    if (res.status === 401) return 'Wrong pairing code.';
    if (!res.ok) return `Relay answered ${res.status}.`;
    return null;
  } catch {
    return 'Could not reach the relay. Same Wi-Fi? Firewall?';
  } finally {
    clearTimeout(timer);
  }
}

export function PairScreen({ onPaired }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (candidate: Pairing) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await pair(candidate);
    setBusy(false);
    if (err) {
      setError(err);
      setScanning(false);
      return;
    }
    onPaired(candidate);
  };

  const onScanned = ({ data }: { data: string }) => {
    if (busy) return;
    try {
      const parsed = JSON.parse(data) as Partial<Pairing>;
      if (typeof parsed.url === 'string' && typeof parsed.code === 'string') {
        setScanning(false);
        void submit({ url: normaliseUrl(parsed.url), code: parsed.code });
        return;
      }
    } catch {
      // Not our QR.
    }
    setError('That QR is not a Sidequest pairing code.');
  };

  const startScan = async () => {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission denied. Type the code instead.');
        return;
      }
    }
    setScanning(true);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.header}>
        <Label>Sidequest</Label>
        <Title>Pair with your relay</Title>
        <Body muted>
          Run <Text style={styles.mono}>npm start</Text> in <Text style={styles.mono}>server/</Text> and scan the QR it
          prints, or type the address and code.
        </Body>
      </View>

      {scanning ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.cameraActions}>
            <Button label="Cancel" variant="ghost" onPress={() => setScanning(false)} />
          </View>
        </View>
      ) : (
        <Card>
          <Button label="Scan QR code" onPress={startScan} disabled={busy} />
          <Text style={styles.or}>or</Text>
          <TextInput
            style={styles.input}
            placeholder="10.0.0.215"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="6-digit code"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Button
            label={busy ? 'Pairing…' : 'Pair'}
            variant="ghost"
            disabled={busy || url.trim().length === 0 || code.length !== 6}
            onPress={() => void submit({ url: normaliseUrl(url), code })}
          />
        </Card>
      )}

      {busy && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />}
      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.lg, justifyContent: 'center' },
  header: { gap: spacing.sm },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: colors.text },
  cameraWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card, gap: spacing.md },
  camera: { width: '100%', aspectRatio: 1 },
  cameraActions: { padding: spacing.md },
  or: { color: colors.muted, textAlign: 'center' },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeInput: { letterSpacing: 6, textAlign: 'center', fontSize: 20, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
});
