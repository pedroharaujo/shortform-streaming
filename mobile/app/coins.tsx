import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createAppMeClient,
  createAppPackPreviewClient,
  createAppWalletClient,
} from '../src/api/createAppClients';
import { getAuthSession, getSessionCredential, subscribeAuthSession } from '../src/auth/session';
import { AppSignInScreen } from '../src/features/auth/AppSignInScreen';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { CoinPacksScreen } from '../src/features/purchases/CoinPacksScreen';
import { createAppCheckoutCoordinator } from '../src/features/purchases/createAppCheckoutCoordinator';
import { CoinPurchasePreview } from '../src/features/purchases/CoinPurchasePreview';
import { isPurchasePreviewEnabled } from '../src/features/purchases/purchasePreview';
import { WalletScreen } from '../src/features/wallet/WalletScreen';
import { BottomNav } from '../src/ui/BottomNav';
import { colors } from '../src/ui/theme';

export default function CoinsRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSession);
  const client = useMemo(() => createAppWalletClient(), []);
  const me = useMemo(() => createAppMeClient(), []);
  const packPreview = useMemo(() => createAppPackPreviewClient(), []);
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
  if (session === null) {
    return (
      <AppSignInScreen
        onBack={returnEpisode ? () => router.back() : undefined}
        onFinished={() => {}}
      />
    );
  }
  return (
    <View style={styles.screen}>
      <WalletScreen
        key={visit}
        client={client}
        me={me}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onPendingUnlock={(id) => router.push({ pathname: '/unlock/[id]', params: { id } })}
        onAccount={() => {
          const pathname = getSessionCredential() === null ? '/sign-in' : '/account';
          router.push(returnEpisode ? { pathname, params: { returnEpisode } } : pathname);
        }}
        onReturnToEpisode={
          returnEpisode
            ? () => router.dismissTo({ pathname: '/unlock/[id]', params: { id: returnEpisode } })
            : undefined
        }
        renderPacks={(refreshBalance) =>
          isPurchasePreviewEnabled() ? (
            <CoinPurchasePreview client={packPreview} />
          ) : (
            <CheckoutPacks onBalanceRefresh={refreshBalance} />
          )
        }
      />
      {returnEpisode ? null : (
        <BottomNav
          active="coins"
          onNavigate={(tab) =>
            tab === 'browse'
              ? router.replace('/')
              : router.replace(getSessionCredential() === null ? '/sign-in' : '/account')
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });

// Mounted only for a current signed-in visit, and never in design preview.
function CheckoutPacks({
  onBalanceRefresh,
}: {
  readonly onBalanceRefresh: () => void;
}): JSX.Element {
  const coordinator = useMemo(() => createAppCheckoutCoordinator(), []);
  return <CoinPacksScreen coordinator={coordinator} onBalanceRefresh={onBalanceRefresh} />;
}
