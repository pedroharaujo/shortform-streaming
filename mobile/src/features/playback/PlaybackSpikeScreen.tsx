import type { JSX } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PlaybackClient } from '../../api/playback/types';
import { PlaybackSpikePlayer } from './PlaybackSpikePlayer';
import { usePlaybackAuthorize } from './usePlaybackAuthorize';

export interface PlaybackSpikeScreenProps {
  readonly client: PlaybackClient;
  readonly episodeId: string;
}

export function PlaybackSpikeScreen({ client, episodeId }: PlaybackSpikeScreenProps): JSX.Element {
  const { state, refresh } = usePlaybackAuthorize(client, episodeId);

  return (
    <SafeAreaView style={styles.container} testID="playback-spike-screen">
      <Text accessibilityRole="header" style={styles.kicker}>
        Playback spike
      </Text>
      <Text style={styles.muted}>expo-video · Django-authorized HLS · no Bunny web player</Text>

      {state.phase === 'loading' ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.centered}
          testID="playback-spike-loading"
        >
          <ActivityIndicator accessibilityLabel="Loading playback" />
          <Text style={styles.muted}>Authorizing playback…</Text>
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View style={styles.centered} testID="playback-spike-error">
          <Text style={styles.body}>{state.message}</Text>
          <Pressable
            accessibilityLabel="Try again"
            accessibilityRole="button"
            onPress={refresh}
            style={styles.button}
            testID="playback-spike-retry"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <View style={styles.playerWrap} testID="playback-spike-loaded">
          <PlaybackSpikePlayer uri={state.playbackUrl} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  button: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonLabel: { color: '#fafafa', fontSize: 16 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  kicker: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginBottom: 4 },
  muted: { color: '#a1a1aa', fontSize: 14, marginBottom: 16 },
  playerWrap: { flex: 1, marginTop: 12 },
});
