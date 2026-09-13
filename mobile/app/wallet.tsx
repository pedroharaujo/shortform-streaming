import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { createAppMeClient, createAppWalletClient } from '../src/api/createAppClients';
import { getSessionCredential } from '../src/auth/session';
import { getPurchaseConfiguration } from '../src/config/appConfiguration';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { WalletScreen } from '../src/features/wallet/WalletScreen';

export default function WalletRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const client = useMemo(() => createAppWalletClient(), []);
  const me = useMemo(() => createAppMeClient(), []);
  const purchasesEnabled =
    __DEV__ &&
    Platform.OS === 'android' &&
    getPurchaseConfiguration().mode === 'revenuecat_sandbox';
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  return (
    <WalletScreen
      key={visit}
      client={client}
      me={me}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
      onPurchases={() =>
        router.push(
          returnEpisode ? { pathname: '/purchases', params: { returnEpisode } } : '/purchases',
        )
      }
      onPendingUnlock={(id) => router.push({ pathname: '/unlock/[id]', params: { id } })}
      onBuyCoins={
        purchasesEnabled
          ? () =>
              router.push(
                returnEpisode
                  ? { pathname: '/buy-coins', params: { returnEpisode } }
                  : '/buy-coins',
              )
          : undefined
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
