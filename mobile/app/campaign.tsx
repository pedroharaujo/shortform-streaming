import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useCallback, useMemo } from 'react';

import { createAppCatalogClient } from '../src/api/createAppClients';
import { CampaignLandingScreen } from '../src/features/campaigns/CampaignLandingScreen';
import { readRouteId } from '../src/features/catalog/readRouteId';

const SAFE_SERIES_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export default function CampaignLandingRoute(): JSX.Element {
  const params = useLocalSearchParams<{ series_id?: string | string[] }>();
  const routeId = readRouteId(params.series_id);
  const seriesId = SAFE_SERIES_ID.test(routeId) ? routeId : '';
  const client = useMemo(() => createAppCatalogClient(), []);
  const onResolve = useCallback((eligibleSeriesId: string | null) => {
    router.replace(eligibleSeriesId === null ? '/' : `/series/${eligibleSeriesId}`);
  }, []);

  return <CampaignLandingScreen client={client} onResolve={onResolve} seriesId={seriesId} />;
}
