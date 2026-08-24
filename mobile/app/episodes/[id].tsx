import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { createCatalogClient } from '../../src/api/catalog/catalogClient';
import { resolveCatalogPlatform } from '../../src/api/catalog/catalogPlatform';
import { getApiConfiguration } from '../../src/config/appConfiguration';
import { EpisodeSelectedScreen } from '../../src/features/catalog/EpisodeSelectedScreen';
import { readRouteId } from '../../src/features/catalog/readRouteId';

export default function EpisodeSelectedRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
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
    <EpisodeSelectedScreen client={client} episodeId={episodeId} onBack={() => router.back()} />
  );
}
