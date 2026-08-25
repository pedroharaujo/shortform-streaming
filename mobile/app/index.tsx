import { router } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { createCatalogClient } from '../src/api/catalog/catalogClient';
import { resolveCatalogPlatform } from '../src/api/catalog/catalogPlatform';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { HomeCatalogScreen } from '../src/features/catalog/HomeCatalogScreen';

export default function HomeRoute(): JSX.Element {
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
    <HomeCatalogScreen
      client={client}
      onOpenHealth={() => router.push('/health')}
      onOpenSignIn={() => router.push('/sign-in')}
      onSelectSeries={(seriesId) => router.push(`/series/${seriesId}`)}
    />
  );
}
