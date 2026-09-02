import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesCard } from '../../api/catalog/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, spacing } from '../../ui/theme';
import { CatalogArtwork } from './CatalogArtwork';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogHome } from './useCatalog';

export interface HomeCatalogScreenProps {
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
      style={styles.card}
      testID={`series-card-${series.id}`}
    >
      <CatalogArtwork size="card" title={series.title} uri={series.artwork_url} />
      <Text style={styles.cardTitle}>{series.title}</Text>
      <Text numberOfLines={3} style={styles.cardSynopsis}>
        {series.synopsis}
      </Text>
    </Pressable>
  );
}

export function HomeCatalogScreen({
  client,
  onSelectSeries,
  onOpenSignIn,
  onOpenAccount,
}: HomeCatalogScreenProps): JSX.Element {
  const { state, refresh } = useCatalogHome(client);
  const messages = useMessages();

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <Text accessibilityRole="header" style={styles.title}>
        {messages.catalog.homeTitle}
      </Text>

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
          <Text style={styles.body}>{messages.catalog.empty}</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView contentContainerStyle={styles.rails} testID="home-loaded">
          {state.home.rails.map((rail) =>
            rail.series.length === 0 ? null : (
              <View key={rail.id} style={styles.rail} testID={`home-rail-${rail.id}`}>
                <Text accessibilityRole="header" style={styles.railTitle}>
                  {rail.title}
                </Text>
                <View style={styles.railRow}>
                  {rail.series.map((series) => (
                    <SeriesCard key={series.id} onSelect={onSelectSeries} series={series} />
                  ))}
                </View>
              </View>
            ),
          )}
        </ScrollView>
      ) : null}

      <Pressable
        accessibilityLabel={messages.common.signIn}
        accessibilityRole="button"
        onPress={onOpenSignIn}
        style={styles.healthLink}
        testID="home-sign-in"
      >
        <Text style={styles.healthLinkLabel}>{messages.common.signIn}</Text>
      </Pressable>
      {onOpenAccount !== undefined ? (
        <Pressable
          accessibilityLabel={messages.common.account}
          accessibilityRole="button"
          onPress={onOpenAccount}
          style={styles.healthLink}
        >
          <Text style={styles.healthLinkLabel}>{messages.common.account}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  card: { marginEnd: spacing.md, width: 160 },
  cardSynopsis: { color: colors.muted, fontSize: fontSizes.caption, marginTop: spacing.xs },
  cardTitle: {
    color: colors.foreground,
    fontSize: fontSizes.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  centered: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  container: { backgroundColor: colors.background, flex: 1, padding: spacing.xxl },
  healthLink: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  healthLinkLabel: { color: colors.muted, fontSize: fontSizes.label, textAlign: 'center' },
  rail: { marginBottom: spacing.xxl },
  railRow: { flexDirection: 'row', flexWrap: 'wrap' },
  railTitle: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  rails: { paddingBottom: spacing.lg },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
});
