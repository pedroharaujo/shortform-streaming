import { router } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppCatalogClient } from '../src/api/createAppClients';
import { getAppAnalyticsRuntime } from '../src/analytics/appAnalytics';
import { HomeCatalogScreen } from '../src/features/catalog/HomeCatalogScreen';

export default function HomeRoute(): JSX.Element {
  const client = useMemo(() => createAppCatalogClient(), []);
  const analytics = useMemo(() => getAppAnalyticsRuntime(), []);

  return (
    <HomeCatalogScreen
      analytics={analytics}
      client={client}
      {...(__DEV__ ? { onOpenHealth: () => router.push('/health') } : {})}
      onOpenSignIn={() => router.push('/sign-in')}
      onOpenAccount={() => router.push('/account')}
      onSelectSeries={(seriesId) => router.push(`/series/${seriesId}`)}
    />
  );
}
