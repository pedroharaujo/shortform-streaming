import type { JSX } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesCard } from '../../api/catalog/types';
import { CatalogArtwork } from './CatalogArtwork';
import { useCatalogHome } from './useCatalogHome';

export interface HomeCatalogScreenProps {
  readonly client: CatalogClient;
  readonly onSelectSeries: (seriesId: string) => void;
  readonly onOpenHealth: () => void;
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
  onOpenHealth,
}: HomeCatalogScreenProps): JSX.Element {
  const { state, refresh } = useCatalogHome(client);

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Home
      </Text>

      {state.phase === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.centered} testID="home-loading">
          <ActivityIndicator accessibilityLabel="Loading catalog" />
          <Text style={styles.muted}>Loading catalog…</Text>
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View style={styles.centered} testID="home-error">
          <Text style={styles.body}>{state.message}</Text>
          <Pressable
            accessibilityLabel="Try again"
            accessibilityRole="button"
            onPress={refresh}
            style={styles.button}
            testID="home-retry"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

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
        accessibilityLabel="Backend availability"
        accessibilityRole="button"
        onPress={onOpenHealth}
        style={styles.healthLink}
        testID="home-health"
      >
        <Text style={styles.healthLinkLabel}>Backend availability</Text>
      </Pressable>
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
  card: { marginRight: 12, width: 160 },
  cardSynopsis: { color: '#a1a1aa', fontSize: 13, marginTop: 4 },
  cardTitle: { color: '#fafafa', fontSize: 16, fontWeight: '600', marginTop: 8 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  healthLink: { alignSelf: 'center', marginTop: 16, padding: 8 },
  healthLinkLabel: { color: '#a1a1aa', fontSize: 14 },
  muted: { color: '#a1a1aa', fontSize: 16 },
  rail: { marginBottom: 24 },
  railRow: { flexDirection: 'row', flexWrap: 'wrap' },
  railTitle: { color: '#fafafa', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  rails: { paddingBottom: 16 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginBottom: 16 },
});
