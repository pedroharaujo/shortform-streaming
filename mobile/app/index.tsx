import { router } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppCatalogClient } from '../src/api/createAppClients';
import { HomeCatalogScreen } from '../src/features/catalog/HomeCatalogScreen';

export default function HomeRoute(): JSX.Element {
  const client = useMemo(() => createAppCatalogClient(), []);

  return (
    <HomeCatalogScreen
      client={client}
      {...(__DEV__ ? { onOpenHealth: () => router.push('/health') } : {})}
      onOpenSignIn={() => router.push('/sign-in')}
      onOpenAccount={() => router.push('/account')}
      onSelectSeries={(seriesId) => router.push(`/series/${seriesId}`)}
    />
  );
}
