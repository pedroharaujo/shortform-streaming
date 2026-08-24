import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { createCatalogClient } from '../../src/api/catalog/catalogClient';
import { resolveCatalogPlatform } from '../../src/api/catalog/catalogPlatform';
import { getApiConfiguration } from '../../src/config/appConfiguration';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { SeriesDetailScreen } from '../../src/features/catalog/SeriesDetailScreen';

export default function SeriesDetailRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const seriesId = readRouteId(params.id);
  const configuration = useMemo(() => getApiConfiguration(), []);
  const client = useMemo(
    () =>
      createCatalogClient({
        baseUrl: configuration.baseUrl,
        territory: configuration.catalogTerritory,
        platform: resolveCatalogPlatform(Platform.OS),
      }),
    [configuration.baseUrl, configuration.catalogTerritory],
  );

  return (
    <SeriesDetailScreen
      client={client}
      onBack={() => router.back()}
      onSelectEpisode={(episodeId) => router.push(`/episodes/${episodeId}`)}
      seriesId={seriesId}
    />
  );
}
