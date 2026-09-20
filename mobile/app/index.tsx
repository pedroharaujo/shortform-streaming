import { router } from 'expo-router';
import type { JSX } from 'react';
import { useMemo, useSyncExternalStore } from 'react';

import { createAppCatalogClient, createAppWalletClient } from '../src/api/createAppClients';
import { getAuthSession, getAuthSessionRevision, subscribeAuthSession } from '../src/auth/session';
import { HomeCatalogScreen } from '../src/features/catalog/HomeCatalogScreen';
import { HomeWalletButton } from '../src/features/wallet/HomeWalletButton';

export default function HomeRoute(): JSX.Element {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSession);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const client = useMemo(() => createAppCatalogClient(), []);
  const wallet = useMemo(() => createAppWalletClient(), []);

  return (
    <HomeCatalogScreen
      client={client}
      signedIn={session !== null}
      walletShortcut={
        session !== null ? (
          <HomeWalletButton
            key={revision}
            owner={revision}
            client={wallet}
            onPress={() => router.push('/coins')}
          />
        ) : undefined
      }
      onOpenSignIn={() => router.push('/sign-in')}
      onOpenAccount={() => router.push('/account')}
      onSelectSeries={(seriesId) => router.push(`/series/${seriesId}`)}
    />
  );
}
