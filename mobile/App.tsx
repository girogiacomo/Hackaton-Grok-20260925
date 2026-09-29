import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { loadLook, loadPairing, saveLook, savePairing, type Look, type Pairing } from './src/storage';
import { useRelay } from './src/useRelay';
import { PairScreen } from './src/screens/PairScreen';
import { WaitFlip } from './src/components/WaitFlip';

function webPair(): Pairing | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return { url: window.location.origin, code: '897760' };
}

function usePixelFont(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: PressStart2P;
        src: url('/PressStart2P-Regular.ttf') format('truetype');
        font-display: swap;
      }
      html, body, #root { background: #4ec0ca; height: 100%; }
      [data-look="classic"], [data-look="classic"] * {
        font-family: PressStart2P, monospace !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function App() {
  usePixelFont();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [look, setLook] = useState<Look>('classic');
  const [loaded, setLoaded] = useState(false);
  const relay = useRelay(pairing);

  useEffect(() => {
    void Promise.all([loadPairing(), loadLook()]).then(([saved, savedLook]) => {
      const next = saved ?? webPair();
      setPairing(next);
      setLook(savedLook);
      if (next && !saved) void savePairing(next);
      setLoaded(true);
    });
  }, []);

  const onLook = (next: Look) => {
    setLook(next);
    void saveLook(next);
  };

  let screen;
  if (!loaded) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  } else if (!pairing) {
    screen = <PairScreen onPaired={(p) => void savePairing(p).then(() => setPairing(p))} />;
  } else {
    screen = <WaitFlip relay={relay} look={look} onLook={onLook} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        {screen}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
