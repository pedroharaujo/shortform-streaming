import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type JSX } from 'react';

import { getSessionCredential } from '../src/auth/session';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { CoinPacksScreen } from '../src/features/purchases/CoinPacksScreen';
import { createAppCheckoutCoordinator } from '../src/features/purchases/createAppCheckoutCoordinator';

export default function BuyCoinsRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const [visit, setVisit] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setVisit((value) => value + 1);
    }, []),
  );
  return <CheckoutVisit key={visit} returnEpisode={returnEpisode} />;
}

function CheckoutVisit({
  returnEpisode,
}: {
  readonly returnEpisode: string | undefined;
}): JSX.Element {
  const coordinator = useMemo(() => createAppCheckoutCoordinator(), []);
  const wallet = returnEpisode
    ? { pathname: '/wallet' as const, params: { returnEpisode } }
    : '/wallet';
  return (
    <CoinPacksScreen
      coordinator={coordinator}
      onBack={() => (router.canGoBack() ? router.back() : router.replace(wallet))}
      onWallet={() => router.dismissTo(wallet)}
      onPurchases={() =>
        router.push(
          returnEpisode ? { pathname: '/purchases', params: { returnEpisode } } : '/purchases',
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
