import Play from 'lucide-react-native/icons/play';
import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogEpisodeSummary } from '../../api/catalog/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { CatalogHero } from './CatalogHero';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogSeries } from './useCatalog';

export interface SeriesDetailScreenProps {
  readonly client: CatalogClient;
  readonly seriesId: string;
  readonly onSelectEpisode: (episodeId: string) => void;
  readonly onBack: () => void;
}

/** Compact episode card. Access is decided by the server after selection; no lock badges here. */
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
      style={({ pressed }) => [styles.episodeRow, pressed && styles.pressed]}
      testID={`episode-row-${episode.id}`}
    >
      <View style={styles.episodeNumber}>
        <Text style={styles.numberLabel}>{episode.order}</Text>
      </View>
      <View style={styles.episodeCopy}>
        <Text numberOfLines={1} style={styles.episodeTitle}>
          {episode.title}
        </Text>
        <Text style={styles.episodeMeta}>
          {messages.catalog.episode(episode.order)} ·{' '}
          {messages.catalog.duration(episode.duration_seconds)}
        </Text>
        <Text numberOfLines={2} style={styles.muted}>
          {episode.synopsis}
        </Text>
      </View>
      <View style={styles.playChip}>
        <Play color={colors.brand} fill={colors.brand} size={12} strokeWidth={2} />
      </View>
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
  const firstEpisode =
    state.phase === 'loaded'
      ? state.series.seasons.flatMap((season) => season.episodes)[0]
      : undefined;
  const episodeTotal =
    state.phase === 'loaded'
      ? state.series.seasons.reduce((count, season) => count + season.episodes.length, 0)
      : 0;

  return (
    <SafeAreaView style={styles.container} testID="series-detail-screen">
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={messages.common.back}
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          testID="series-detail-back"
        >
          <Text accessible={false} style={styles.backArrow}>
            ‹
          </Text>
          <Text style={styles.backLabel}>{messages.common.back}</Text>
        </Pressable>
      </View>

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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          testID="series-detail-loaded"
        >
          <CatalogHero compact title={state.series.title} uri={state.series.artwork_url}>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>
                  {messages.catalog.episodeCount(episodeTotal)}
                </Text>
              </View>
              {state.series.genres.slice(0, 2).map((genre) => (
                <Text key={genre} style={styles.metaGenre}>
                  {genre}
                </Text>
              ))}
            </View>
            <Text accessibilityRole="header" style={styles.title} testID="series-detail-title">
              {state.series.title}
            </Text>
          </CatalogHero>

          {firstEpisode !== undefined ? (
            <Pressable
              accessibilityLabel={`${messages.catalog.startWatching}: ${messages.catalog.episodeLabel(firstEpisode.order, firstEpisode.title)}`}
              accessibilityRole="button"
              onPress={() => onSelectEpisode(firstEpisode.id)}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              testID="series-detail-start"
            >
              <Play color={colors.onAccent} fill={colors.onAccent} size={16} strokeWidth={2} />
              <Text style={styles.primaryLabel}>
                {messages.catalog.startWatching} · {messages.catalog.episode(firstEpisode.order)}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{messages.catalog.synopsis.toUpperCase()}</Text>
            <Text style={styles.synopsis}>{state.series.synopsis}</Text>
            {state.series.genres.length > 0 ? (
              <View style={styles.genres}>
                {state.series.genres.map((genre) => (
                  <View key={genre} style={styles.genreChip}>
                    <Text style={styles.genreLabel}>#{genre}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {state.series.seasons.map((season) => (
            <View
              key={season.number}
              style={styles.section}
              testID={`series-season-${season.number}`}
            >
              <View style={styles.sectionHeading}>
                <Text accessibilityRole="header" style={styles.sectionLabel}>
                  {messages.catalog.episodes.toUpperCase()} ({season.episodes.length})
                </Text>
                {state.series.seasons.length > 1 ? (
                  <Text style={styles.seasonLabel}>{messages.catalog.season(season.number)}</Text>
                ) : null}
              </View>
              <View style={styles.episodeList}>
                {season.episodes.map((episode) => (
                  <EpisodeRow episode={episode} key={episode.id} onSelect={onSelectEpisode} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  backArrow: { color: colors.foreground, fontSize: 30, lineHeight: 32 },
  backLabel: { color: colors.foreground, fontSize: fontSizes.body },
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xxl },
  content: { gap: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaChip: {
    backgroundColor: 'rgba(23, 23, 23, 0.9)',
    borderColor: colors.coinRim,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  metaChipLabel: {
    color: colors.coin,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaGenre: { color: colors.muted, fontSize: fontSizes.caption, fontWeight: '600' },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 38,
  },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    minHeight: minimumTouchTarget + 4,
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: { color: colors.onAccent, fontSize: fontSizes.body, fontWeight: '800' },

  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  seasonLabel: { color: colors.brand, fontSize: fontSizes.caption, fontWeight: '700' },
  synopsis: { color: colors.foreground, fontSize: fontSizes.label, lineHeight: 22 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  genreChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  genreLabel: { color: colors.muted, fontSize: fontSizes.caption, fontWeight: '600' },

  episodeList: { gap: spacing.sm },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minimumTouchTarget,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  episodeNumber: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberLabel: {
    color: colors.foreground,
    fontSize: fontSizes.label,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  episodeCopy: { flex: 1, gap: spacing.xxs },
  episodeTitle: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '800' },
  episodeMeta: { color: colors.brand, fontSize: fontSizes.caption, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: fontSizes.caption, lineHeight: 18 },
  playChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
