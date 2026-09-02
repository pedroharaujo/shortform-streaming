import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogEpisodeSummary } from '../../api/catalog/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { CatalogArtwork } from './CatalogArtwork';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogSeries } from './useCatalog';

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
  const messages = useMessages();
  return (
    <Pressable
      accessibilityLabel={messages.catalog.episodeLabel(episode.order, episode.title)}
      accessibilityRole="button"
      onPress={() => onSelect(episode.id)}
      style={styles.episodeRow}
      testID={`episode-row-${episode.id}`}
    >
      <Text style={styles.episodeOrder}>{messages.catalog.episode(episode.order)}</Text>
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
  const messages = useMessages();

  return (
    <SafeAreaView style={styles.container} testID="series-detail-screen">
      <Pressable
        accessibilityLabel={messages.common.back}
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
        testID="series-detail-back"
      >
        <Text style={styles.backLabel}>{messages.common.back}</Text>
      </Pressable>

      <CatalogFetchStatus
        errorKind={state.phase === 'error' ? state.kind : undefined}
        loadingAccessibilityLabel={messages.catalog.seriesLoadingLabel}
        loadingText={messages.catalog.seriesLoading}
        onRetry={refresh}
        phase={state.phase}
        testIDPrefix="series-detail"
      />

      {state.phase === 'not-found' ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.centered}
          testID="series-detail-not-found"
        >
          <Text style={styles.body}>{messages.catalog.titleNotAvailable}</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView contentContainerStyle={styles.content} testID="series-detail-loaded">
          <CatalogArtwork size="hero" title={state.series.title} uri={state.series.artwork_url} />
          <Text accessibilityRole="header" style={styles.title} testID="series-detail-title">
            {state.series.title}
          </Text>
          <Text style={styles.synopsis}>{state.series.synopsis}</Text>
          {state.series.seasons.map((season) => (
            <View key={season.number} testID={`series-season-${season.number}`}>
              <Text accessibilityRole="header" style={styles.seasonTitle}>
                {messages.catalog.season(season.number)}
              </Text>
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
  back: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
  },
  backLabel: { color: colors.muted, fontSize: fontSizes.body },
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  container: { backgroundColor: colors.background, flex: 1, padding: spacing.xxl },
  content: { paddingBottom: spacing.xxl },
  episodeOrder: {
    color: colors.muted,
    fontSize: fontSizes.caption,
    marginBottom: spacing.xxs,
  },
  episodeRow: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    minHeight: minimumTouchTarget,
    padding: spacing.md,
  },
  episodeTitle: { color: colors.foreground, fontSize: fontSizes.body, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: fontSizes.body },
  seasonTitle: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '600',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  synopsis: {
    color: colors.muted,
    fontSize: fontSizes.body,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
});
