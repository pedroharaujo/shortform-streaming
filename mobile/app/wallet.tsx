import { Redirect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { readRouteId } from '../src/features/catalog/readRouteId';

/** Keep old links working without maintaining a separate wallet destination. */
export default function WalletRedirect(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  return (
    <Redirect href={returnEpisode ? { pathname: '/coins', params: { returnEpisode } } : '/coins'} />
  );
}
