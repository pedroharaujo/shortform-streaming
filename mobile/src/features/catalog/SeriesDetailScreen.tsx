import type { JSX } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogEpisodeSummary } from '../../api/catalog/types';
import { CatalogArtwork } from './CatalogArtwork';
import { useCatalogSeries } from './useCatalogSeries';

export interface SeriesDetailScreenProps {
  readonly client: CatalogClient;
  readonly seriesId: string;
  readonly onSelectEpisode: (episodeId: string) => void;
  readonly onBack: () => void;
}

function EpisodeRow({
  episode,
  onSelect,
}: {
  episode: CatalogEpisodeSummary;
  onSelect: (episodeId: string) => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={episode.title}
      accessibilityRole="button"
      onPress={() => onSelect(episode.id)}
      style={styles.episodeRow}
      testID={`episode-row-${episode.id}`}
    >
      <Text style={styles.episodeOrder}>Episode {episode.order}</Text>
      <Text style={styles.episodeTitle}>{episode.title}</Text>
      <Text numberOfLines={2} style={styles.muted}>
        {episode.synopsis}
      </Text>
    </Pressable>
  );
}

export function SeriesDetailScreen({
  client,
  seriesId,
  onSelectEpisode,
  onBack,
}: SeriesDetailScreenProps): JSX.Element {
  const { state, refresh } = useCatalogSeries(client, seriesId);

  return (
    <SafeAreaView style={styles.container} testID="series-detail-screen">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
        testID="series-detail-back"
      >
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      {state.phase === 'loading' ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.centered}
          testID="series-detail-loading"
        >
          <ActivityIndicator accessibilityLabel="Loading series" />
          <Text style={styles.muted}>Loading series…</Text>
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View style={styles.centered} testID="series-detail-error">
          <Text style={styles.body}>{state.message}</Text>
          <Pressable
            accessibilityLabel="Try again"
            accessibilityRole="button"
            onPress={refresh}
            style={styles.button}
            testID="series-detail-retry"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {state.phase === 'not-found' ? (
        <View style={styles.centered} testID="series-detail-not-found">
          <Text style={styles.body}>This title is not available.</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <CatalogArtwork size="hero" title={state.series.title} uri={state.series.artwork_url} />
          <Text accessibilityRole="header" style={styles.title}>
            {state.series.title}
          </Text>
          <Text style={styles.synopsis}>{state.series.synopsis}</Text>
          {state.series.seasons.map((season) => (
            <View key={season.number} testID={`series-season-${season.number}`}>
              <Text style={styles.seasonTitle}>Season {season.number}</Text>
              {season.episodes.map((episode) => (
                <EpisodeRow episode={episode} key={episode.id} onSelect={onSelectEpisode} />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 4 },
  backLabel: { color: '#a1a1aa', fontSize: 16 },
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
  content: { paddingBottom: 24 },
  episodeOrder: { color: '#a1a1aa', fontSize: 13, marginBottom: 2 },
  episodeRow: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  episodeTitle: { color: '#fafafa', fontSize: 16, fontWeight: '600' },
  muted: { color: '#a1a1aa', fontSize: 16 },
  seasonTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  synopsis: { color: '#a1a1aa', fontSize: 15, marginBottom: 8, marginTop: 8 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginTop: 16 },
});
