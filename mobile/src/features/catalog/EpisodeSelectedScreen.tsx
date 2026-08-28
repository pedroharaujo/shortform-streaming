import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient } from '../../api/catalog/types';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogEpisode } from './useCatalog';

export interface EpisodeSelectedScreenProps {
  readonly client: CatalogClient;
  readonly episodeId: string;
  readonly onBack: () => void;
}

export function EpisodeSelectedScreen({
  client,
  episodeId,
  onBack,
}: EpisodeSelectedScreenProps): JSX.Element {
  const { state, refresh } = useCatalogEpisode(client, episodeId);

  return (
    <SafeAreaView style={styles.container} testID="episode-selected-screen">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
        testID="episode-selected-back"
      >
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <CatalogFetchStatus
        errorMessage={state.phase === 'error' ? state.message : undefined}
        loadingAccessibilityLabel="Loading episode"
        loadingText="Loading episode…"
        onRetry={refresh}
        phase={state.phase}
        testIDPrefix="episode-selected"
      />

      {state.phase === 'not-found' ? (
        <View style={styles.centered} testID="episode-selected-not-found">
          <Text style={styles.body}>This episode is not available.</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <View testID="episode-selected">
          <Text accessibilityRole="header" style={styles.kicker}>
            Selected episode
          </Text>
          <Text style={styles.title}>{state.episode.title}</Text>
          <Text style={styles.synopsis}>{state.episode.synopsis}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 4 },
  backLabel: { color: '#a1a1aa', fontSize: 16 },
  body: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  kicker: { color: '#a1a1aa', fontSize: 14, marginBottom: 8 },
  synopsis: { color: '#a1a1aa', fontSize: 15, marginTop: 8 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600' },
});
