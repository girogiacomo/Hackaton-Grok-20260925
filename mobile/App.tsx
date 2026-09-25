import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { clearPairing, loadPairing, savePairing, type Pairing } from './src/storage';
import { useRelay } from './src/useRelay';
import { PairScreen } from './src/screens/PairScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { RunScreen } from './src/screens/RunScreen';

export default function App() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const relay = useRelay(pairing);

  useEffect(() => {
    void loadPairing().then((p) => {
      setPairing(p);
      setLoaded(true);
    });
  }, []);

  const onPaired = async (p: Pairing) => {
    await savePairing(p);
    setPairing(p);
  };

  const onUnpair = async () => {
    await clearPairing();
    setPairing(null);
  };

  let screen;
  if (!loaded) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  } else if (!pairing) {
    screen = <PairScreen onPaired={(p) => void onPaired(p)} />;
  } else if (relay.run) {
    screen = <RunScreen run={relay.run} quizResult={relay.quizResult} send={relay.send} onDismiss={relay.dismissRun} />;
  } else {
    screen = (
      <HomeScreen
        status={relay.status}
        pairing={pairing}
        stats={relay.stats}
        mode={relay.mode}
        send={relay.send}
        onUnpair={() => void onUnpair()}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        {screen}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
