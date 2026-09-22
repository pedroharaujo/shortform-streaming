import Film from 'lucide-react-native/icons/film';
import Play from 'lucide-react-native/icons/play';
import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesCard } from '../../api/catalog/types';
import type { ContinueWatchingItem, ProgressClient } from '../../api/progress/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { ProfileAvatar } from '../../ui/ScreenElements';
import { CatalogArtwork } from './CatalogArtwork';
import { CatalogHero } from './CatalogHero';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogHome } from './useCatalog';

export interface HomeCatalogScreenProps {
  readonly signedIn?: boolean;
  readonly walletShortcut?: JSX.Element | undefined;
  readonly client: CatalogClient;
  readonly onSelectSeries: (seriesId: string) => void;
  readonly onOpenSignIn: () => void;
  readonly onOpenAccount?: () => void;
  readonly progress?: ProgressClient;
  readonly onResumeEpisode?: (episodeId: string) => void;
}

/** Web Navbar wordmark: white → neutral-100 → amber-200; logo tile amber→rose→violet. */
const wordmarkShades = [
  '#ffffff',
  '#f5f5f5',
  '#e5e5e5',
  colors.brandHighlight,
  '#fcd34d',
  colors.coin,
] as const;

function shownFreeEpisodes(series: CatalogSeriesCard): number {
  if (series.episode_count <= 0 || series.free_episode_count <= 0) return 0;
  return Math.min(series.free_episode_count, series.episode_count);
}

/** Poster card with overlay badges, laid out two per row like the reference design. */
function SeriesCard({
  series,
  onSelect,
}: {
  series: CatalogSeriesCard;
  onSelect: (seriesId: string) => void;
}): JSX.Element {
  const messages = useMessages();
  const freeCount = shownFreeEpisodes(series);
  return (
    <Pressable
      accessibilityLabel={series.title}
      accessibilityRole="button"
      onPress={() => onSelect(series.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`series-card-${series.id}`}
    >
      <View style={styles.poster}>
        <CatalogArtwork size="card" title={series.title} uri={series.artwork_url} />
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.posterShade}
        />
        {freeCount > 0 ? (
          <View style={styles.posterBadge}>
            <Text style={styles.posterBadgeLabel}>{messages.catalog.freeEpisodes(freeCount)}</Text>
          </View>
        ) : null}
        {series.episode_count > 0 ? (
          <View style={styles.posterMeta}>
            <Text style={styles.posterMetaLabel}>
              {messages.catalog.episodeCount(series.episode_count)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {series.title}
        </Text>
        <Text numberOfLines={2} style={styles.cardSynopsis}>
          {series.synopsis}
        </Text>
        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.cardTag}>
            {series.genres[0] ? `#${series.genres[0]}` : messages.catalog.featured}
          </Text>
          <View style={styles.playPill}>
            <Text style={styles.playPillLabel}>{messages.common.play}</Text>
            <Play color={colors.onAccent} fill={colors.onAccent} size={10} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeCatalogScreen({
  client,
  signedIn = false,
  walletShortcut,
  onSelectSeries,
  onOpenSignIn,
  onOpenAccount,
  progress,
  onResumeEpisode,
}: HomeCatalogScreenProps): JSX.Element {
  const { state, refresh } = useCatalogHome(client);
  const messages = useMessages();
  const { width, fontScale } = useWindowDimensions();
  const compactHeader = signedIn && (width < 380 || fontScale > 1.2);
  const firstRail =
    state.phase === 'loaded' ? state.home.rails.find((rail) => rail.series.length > 0) : undefined;
  const [genre, setGenre] = useState(messages.catalog.allGenres);
  const genres = [...new Set((firstRail?.series ?? []).flatMap((series) => series.genres))];
  const [continueItems, setContinueItems] = useState<readonly ContinueWatchingItem[]>([]);
  useEffect(() => {
    if (progress === undefined) return undefined;
    let active = true;
    void progress.listContinue().then((result) => {
      if (!active) return;
      setContinueItems(result.outcome === 'ok' ? result.data.items : []);
    });
    return () => {
      active = false;
    };
  }, [progress]);
  const featured = genre === messages.catalog.allGenres ? firstRail?.series[0] : undefined;
  const freeFeatured = featured ? shownFreeEpisodes(featured) : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container} testID="home-screen">
      <View style={styles.header}>
        <View style={styles.brand} accessible accessibilityLabel={messages.catalog.brand}>
          <View style={styles.brandMark} accessible={false}>
            <Film color="#ffffff" size={16} strokeWidth={2} />
          </View>
          {!compactHeader ? (
            <Text style={styles.brandLabel} numberOfLines={1}>
              {messages.catalog.brand
                .toUpperCase()
                .split('')
                .map((letter, index) => (
                  <Text
                    key={`${letter}-${index}`}
                    style={{ color: wordmarkShades[index] ?? colors.brand }}
                  >
                    {letter}
                  </Text>
                ))}
            </Text>
          ) : null}
        </View>
        {signedIn ? (
          <View style={styles.accountActions}>
            {walletShortcut}
            <Pressable
              accessibilityLabel={messages.common.account}
              accessibilityRole="button"
              onPress={onOpenAccount}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
              testID="home-profile"
            >
              <ProfileAvatar />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityLabel={messages.common.signIn}
            accessibilityRole="button"
            onPress={onOpenSignIn}
            style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
            testID="home-sign-in"
          >
            <Text style={styles.signInLabel}>{messages.common.signIn}</Text>
          </Pressable>
        )}
      </View>

      <CatalogFetchStatus
        errorKind={state.phase === 'error' ? state.kind : undefined}
        loadingAccessibilityLabel={messages.catalog.loadingLabel}
        loadingText={messages.catalog.loading}
        onRetry={refresh}
        phase={state.phase}
        testIDPrefix="home"
      />

      {state.phase === 'empty' ? (
        <View accessibilityLiveRegion="polite" style={styles.centered} testID="home-empty">
          <View style={styles.emptyArt}>
            <CatalogArtwork size="card" title={messages.catalog.brand} uri={null} />
          </View>
          <Text style={styles.body}>{messages.catalog.empty}</Text>
          <Text style={styles.emptyHint}>{messages.catalog.emptyHint}</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView
          contentContainerStyle={styles.rails}
          showsVerticalScrollIndicator={false}
          testID="home-loaded"
        >
          {featured !== undefined ? (
            <Pressable
              accessibilityLabel={`${messages.catalog.viewSeries}: ${featured.title}`}
              accessibilityRole="button"
              onPress={() => onSelectSeries(featured.id)}
              style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
              testID="home-featured-series"
            >
              <CatalogHero title={featured.title} uri={featured.artwork_url}>
                <View style={styles.badgeRow}>
                  <View style={styles.featuredBadge}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.eyebrow}>
                      {firstRail && firstRail.title !== messages.catalog.featured
                        ? firstRail.title
                        : messages.catalog.featured}
                    </Text>
                  </View>
                  {featured.episode_count > 0 ? (
                    <View style={styles.railChip}>
                      <Text style={styles.railChipLabel}>
                        {messages.catalog.episodeCount(featured.episode_count)}
                      </Text>
                    </View>
                  ) : null}
                  {freeFeatured > 0 ? (
                    <Text style={styles.freeBadge}>
                      {messages.catalog.freeEpisodes(freeFeatured)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text numberOfLines={3} style={styles.featuredSynopsis}>
                  {featured.synopsis}
                </Text>
                {featured.genres.length > 0 ? (
                  <View style={styles.tagRow}>
                    {featured.genres.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagLabel}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.heroActions}>
                  <View style={styles.explore}>
                    <Play
                      color={colors.onAccent}
                      fill={colors.onAccent}
                      size={16}
                      strokeWidth={2}
                    />
                    <Text style={styles.exploreLabel}>{messages.catalog.startWatching}</Text>
                  </View>
                </View>
              </CatalogHero>
            </Pressable>
          ) : null}
          {continueItems.length > 0 && onResumeEpisode !== undefined ? (
            <View style={styles.rail} testID="home-continue">
              <View style={styles.railHeading}>
                <View style={styles.railAccent} />
                <Text accessibilityRole="header" style={styles.railTitle}>
                  {messages.catalog.continueWatching}
                </Text>
              </View>
              <ScrollView
                horizontal
                contentContainerStyle={styles.continueRow}
                showsHorizontalScrollIndicator={false}
              >
                {continueItems.map((item) => {
                  const progressRatio =
                    item.duration_seconds > 0
                      ? Math.min(1, item.position_seconds / item.duration_seconds)
                      : 0;
                  return (
                    <Pressable
                      key={item.episode_id}
                      accessibilityLabel={messages.catalog.resumeEpisode(
                        item.episode_order,
                        item.series_title,
                      )}
                      accessibilityRole="button"
                      onPress={() => onResumeEpisode(item.episode_id)}
                      style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
                    >
                      <CatalogArtwork
                        size="card"
                        title={item.series_title}
                        uri={item.artwork_url}
                      />
                      <Text numberOfLines={1} style={styles.cardTitle}>
                        {item.series_title}
                      </Text>
                      <Text numberOfLines={1} style={styles.cardSynopsis}>
                        {messages.catalog.episode(item.episode_order)}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                      </View>
                      <View style={styles.resumePill}>
                        <Play color={colors.coin} fill={colors.coin} size={11} strokeWidth={2.5} />
                        <Text style={styles.resumePillLabel}>{messages.catalog.resume}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          {genres.length > 0 ? (
            <ScrollView
              horizontal
              contentContainerStyle={styles.filters}
              showsHorizontalScrollIndicator={false}
              testID="home-genre-filters"
            >
              {[messages.catalog.allGenres, ...genres].map((tag) => {
                const selected = tag === genre;
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setGenre(tag)}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                  >
                    <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {state.home.rails.map((rail) => {
            const visible = rail.series.filter(
              (series) => genre === messages.catalog.allGenres || series.genres.includes(genre),
            );
            if (visible.length === 0) return null;
            return (
              <View key={rail.id} style={styles.rail} testID={`home-rail-${rail.id}`}>
                <View style={styles.railHeading}>
                  <View style={styles.railAccent} />
                  <Text accessibilityRole="header" style={styles.railTitle}>
                    {rail.title}
                  </Text>
                  <Text style={styles.railCount}>
                    {messages.catalog.seriesCount(visible.length)}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {visible.map((series) => (
                    <SeriesCard key={series.id} onSelect={onSelectSeries} series={series} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  continueCard: { gap: spacing.xs, width: 148 },
  continueRow: { gap: spacing.md, paddingRight: spacing.xl },
  container: { backgroundColor: colors.background, flex: 1 },
  progressFill: {
    backgroundColor: colors.brand,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    height: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brand,
    experimental_backgroundImage: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandRose} 55%, ${colors.brandViolet} 100%)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLabel: {
    fontSize: fontSizes.section,
    fontWeight: '800',
    letterSpacing: 3,
    flexShrink: 1,
  },
  signIn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  signInLabel: { color: colors.onAccent, fontSize: fontSizes.label, fontWeight: '800' },
  avatarButton: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  emptyArt: { width: 140, marginBottom: spacing.lg },
  emptyHint: { color: colors.muted, fontSize: fontSizes.body, textAlign: 'center' },
  rails: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  featured: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderRadius: radii.lg,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onAccent },
  eyebrow: { color: colors.onAccent, fontSize: fontSizes.caption, fontWeight: '800' },
  railChip: {
    backgroundColor: 'rgba(38, 38, 38, 0.85)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  railChipLabel: { color: colors.foreground, fontSize: fontSizes.caption, fontWeight: '600' },
  featuredTitle: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 38,
  },
  featuredSynopsis: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 21 },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand,
    experimental_backgroundImage: `linear-gradient(90deg, ${colors.brand} 0%, ${colors.coinRim} 100%)`,
    borderRadius: radii.md,
    minHeight: minimumTouchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  exploreLabel: { color: colors.onAccent, fontSize: fontSizes.label, fontWeight: '800' },
  rail: { marginBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  railHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  railAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: colors.brand },
  railTitle: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '800',
    letterSpacing: -0.4,
    flexShrink: 1,
    flexGrow: 1,
  },
  railCount: { color: colors.muted, fontSize: fontSizes.caption, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '50%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  poster: { width: '100%', backgroundColor: colors.surfaceRaised },
  posterShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    experimental_backgroundImage: `linear-gradient(180deg, rgba(23,23,23,0) 0%, ${colors.surface} 100%)`,
  },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardTitle: {
    color: colors.foreground,
    fontSize: fontSizes.label,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  cardSynopsis: { color: colors.muted, fontSize: fontSizes.caption, lineHeight: 18, minHeight: 36 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  cardTag: { color: colors.muted, fontSize: fontSizes.caption, fontWeight: '600', flexShrink: 1 },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  playPillLabel: { color: colors.onAccent, fontSize: 12, fontWeight: '800' },
  resumePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },
  resumePillLabel: { color: colors.coin, fontSize: 12, fontWeight: '800' },
  posterBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(10, 10, 12, 0.82)',
    borderColor: colors.coinRim,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  posterBadgeLabel: { color: colors.coin, fontSize: 11, fontWeight: '800' },
  posterMeta: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
  },
  posterMetaLabel: { color: colors.foreground, fontSize: 11, fontWeight: '700' },
  freeBadge: { color: colors.coin, fontSize: fontSizes.caption, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tagChip: {
    backgroundColor: 'rgba(23, 23, 23, 0.72)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  tagLabel: { color: colors.foreground, fontSize: 11, fontWeight: '600' },
  filters: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  filterChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: minimumTouchTarget,
    justifyContent: 'center',
  },
  filterChipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterLabel: { color: colors.muted, fontSize: fontSizes.caption, fontWeight: '700' },
  filterLabelSelected: { color: colors.onAccent, fontWeight: '800' },
});
