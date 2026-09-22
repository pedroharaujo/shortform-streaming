import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesCard } from '../../api/catalog/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { ProfileAvatar } from '../../ui/ScreenElements';
import { CatalogArtwork } from './CatalogArtwork';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogHome } from './useCatalog';

export interface HomeCatalogScreenProps {
  readonly signedIn?: boolean;
  readonly walletShortcut?: JSX.Element | undefined;
  readonly client: CatalogClient;
  readonly onSelectSeries: (seriesId: string) => void;
  readonly onOpenSignIn: () => void;
  readonly onOpenAccount?: () => void;
}

function SeriesCard({
  series,
  onSelect,
}: {
  series: CatalogSeriesCard;
  onSelect: (seriesId: string) => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={series.title}
      accessibilityRole="button"
      onPress={() => onSelect(series.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`series-card-${series.id}`}
    >
      <CatalogArtwork size="card" title={series.title} uri={series.artwork_url} />
      <Text style={styles.cardTitle}>{series.title}</Text>
      <Text numberOfLines={2} style={styles.cardSynopsis}>
        {series.synopsis}
      </Text>
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
}: HomeCatalogScreenProps): JSX.Element {
  const { state, refresh } = useCatalogHome(client);
  const messages = useMessages();
  const { width, fontScale } = useWindowDimensions();
  const compactHeader = signedIn && (width < 380 || fontScale > 1.2);
  const firstRail =
    state.phase === 'loaded' ? state.home.rails.find((rail) => rail.series.length > 0) : undefined;
  const featured = firstRail?.series[0];

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <View style={styles.header}>
        <View style={styles.brand} accessible accessibilityLabel={messages.catalog.brand}>
          <View style={styles.brandMark} accessible={false}>
            <View style={styles.playMark} />
          </View>
          {!compactHeader ? (
            <Text style={styles.brandLabel} numberOfLines={1}>
              {messages.catalog.brand}
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
              <CatalogArtwork size="hero" title={featured.title} uri={featured.artwork_url} />
              <View style={styles.featuredContent}>
                <Text style={styles.eyebrow}>{firstRail?.title}</Text>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text numberOfLines={2} style={styles.cardSynopsis}>
                  {featured.synopsis}
                </Text>
                <View style={styles.explore}>
                  <Text style={styles.exploreLabel}>{messages.catalog.viewSeries}</Text>
                  <Text style={styles.exploreLabel} accessible={false}>
                    ↗
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : null}
          {state.home.rails.map((rail) =>
            rail.series.length === 0 ? null : (
              <View key={rail.id} style={styles.rail} testID={`home-rail-${rail.id}`}>
                <Text accessibilityRole="header" style={styles.railTitle}>
                  {rail.title}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.railRow}
                >
                  {rail.series.map((series) => (
                    <SeriesCard key={series.id} onSelect={onSelectSeries} series={series} />
                  ))}
                </ScrollView>
              </View>
            ),
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  card: { width: 148 },
  cardSynopsis: { color: colors.muted, fontSize: fontSizes.caption, marginTop: spacing.xs },
  cardTitle: {
    color: colors.foreground,
    fontSize: fontSizes.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  brandMark: {
    width: 30,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMark: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.onAccent,
    marginStart: 3,
  },
  brandLabel: {
    color: colors.foreground,
    fontSize: fontSizes.label,
    fontWeight: '800',
    letterSpacing: 2,
    flexShrink: 1,
  },
  signIn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  signInLabel: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '600' },
  eyebrow: {
    color: colors.accent,
    fontSize: fontSizes.caption,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  featured: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  featuredContent: { padding: spacing.xl, gap: spacing.sm },
  featuredTitle: { color: colors.foreground, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    minHeight: minimumTouchTarget,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  exploreLabel: { color: colors.onAccent, fontSize: fontSizes.body, fontWeight: '700' },
  avatarButton: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  emptyArt: { width: 140, marginBottom: spacing.lg },
  emptyHint: { color: colors.muted, fontSize: fontSizes.body, textAlign: 'center' },
  rail: { marginBottom: spacing.xxl },
  railRow: { paddingHorizontal: spacing.xl, gap: spacing.md },
  railTitle: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  rails: { paddingTop: spacing.lg, paddingBottom: spacing.lg },
});
