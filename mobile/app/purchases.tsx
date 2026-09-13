import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { createAppPurchasesClient } from '../src/api/createAppClients';
import { getSessionCredential } from '../src/auth/session';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { PurchaseHistoryScreen } from '../src/features/wallet/PurchaseHistoryScreen';

export default function PurchasesRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const client = useMemo(() => createAppPurchasesClient(), []);
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  return (
    <PurchaseHistoryScreen
      key={visit}
      client={client}
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace(
              returnEpisode ? { pathname: '/wallet', params: { returnEpisode } } : '/wallet',
            )
      }
      onAccount={() => {
        const pathname = getSessionCredential() === null ? '/sign-in' : '/account';
        router.push(returnEpisode ? { pathname, params: { returnEpisode } } : pathname);
      }}
      onReturnToEpisode={
        returnEpisode
          ? () => router.dismissTo({ pathname: '/unlock/[id]', params: { id: returnEpisode } })
          : undefined
      }
    />
  );
}
