import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppCatalogClient } from '../../src/api/createAppClients';
import { getAppAnalyticsRuntime } from '../../src/analytics/appAnalytics';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { SeriesDetailScreen } from '../../src/features/catalog/SeriesDetailScreen';

export default function SeriesDetailRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const seriesId = readRouteId(params.id);
  const client = useMemo(() => createAppCatalogClient(), []);
  const analytics = useMemo(() => getAppAnalyticsRuntime(), []);

  return (
    <SeriesDetailScreen
      analytics={analytics}
      client={client}
      onBack={() => router.back()}
      onSelectEpisode={(episodeId) => router.push(`/episodes/${episodeId}`)}
      seriesId={seriesId}
    />
  );
}
