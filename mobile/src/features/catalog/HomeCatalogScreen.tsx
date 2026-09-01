import { useEffect, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesCard } from '../../api/catalog/types';
import type { AnalyticsRuntime } from '../../analytics/runtime';
import { CatalogArtwork } from './CatalogArtwork';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { useCatalogHome } from './useCatalog';

export interface HomeCatalogScreenProps {
  readonly analytics: AnalyticsRuntime;
  readonly client: CatalogClient;
  readonly onSelectSeries: (seriesId: string) => void;
  readonly onOpenHealth?: () => void;
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
  analytics,
  client,
  onSelectSeries,
  onOpenHealth,
  onOpenSignIn,
  onOpenAccount,
}: HomeCatalogScreenProps): JSX.Element {
  const { state, refresh } = useCatalogHome(client);

  useEffect(() => {
    if (state.phase !== 'loaded') return;
    void (async () => {
      await analytics.logOnce('home_viewed', 'home', {});
      let position = 0;
      for (const rail of state.home.rails) {
        for (const series of rail.series) {
          await analytics.logOnce('series_impression', `i:${series.id}:${position}`, {
            series_id: series.id,
            position,
          });
          position += 1;
        }
      }
    })();
  }, [analytics, state]);

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Home
      </Text>

      <CatalogFetchStatus
        errorMessage={state.phase === 'error' ? state.message : undefined}
        loadingAccessibilityLabel="Loading catalog"
        loadingText="Loading catalog…"
        onRetry={refresh}
        phase={state.phase}
        testIDPrefix="home"
      />

      {state.phase === 'empty' ? (
        <View style={styles.centered} testID="home-empty">
          <Text style={styles.body}>No titles are available.</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView contentContainerStyle={styles.rails} testID="home-loaded">
          {state.home.rails.map((rail) =>
            rail.series.length === 0 ? null : (
              <View key={rail.id} style={styles.rail} testID={`home-rail-${rail.id}`}>
                <Text style={styles.railTitle}>{rail.title}</Text>
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
        accessibilityLabel="Sign in"
        accessibilityRole="button"
        onPress={onOpenSignIn}
        style={styles.healthLink}
        testID="home-sign-in"
      >
        <Text style={styles.healthLinkLabel}>Sign in</Text>
      </Pressable>
      {onOpenAccount !== undefined ? (
        <Pressable
          accessibilityLabel="Account"
          accessibilityRole="button"
          onPress={onOpenAccount}
          style={styles.healthLink}
        >
          <Text style={styles.healthLinkLabel}>Account</Text>
        </Pressable>
      ) : null}
      {__DEV__ && onOpenHealth !== undefined ? (
        <Pressable
          accessibilityLabel="Backend availability"
          accessibilityRole="button"
          onPress={onOpenHealth}
          style={styles.healthLink}
          testID="home-health"
        >
          <Text style={styles.healthLinkLabel}>Backend availability</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  card: { marginRight: 12, width: 160 },
  cardSynopsis: { color: '#a1a1aa', fontSize: 13, marginTop: 4 },
  cardTitle: { color: '#fafafa', fontSize: 16, fontWeight: '600', marginTop: 8 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  healthLink: { alignSelf: 'center', marginTop: 16, padding: 8 },
  healthLinkLabel: { color: '#a1a1aa', fontSize: 14 },
  rail: { marginBottom: 24 },
  railRow: { flexDirection: 'row', flexWrap: 'wrap' },
  railTitle: { color: '#fafafa', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  rails: { paddingBottom: 16 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginBottom: 16 },
});
