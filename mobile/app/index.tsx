import { router } from 'expo-router';
import type { JSX } from 'react';
import { useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  createAppCatalogClient,
  createAppProgressClient,
  createAppWalletClient,
} from '../src/api/createAppClients';
import { getAuthSession, getAuthSessionRevision, subscribeAuthSession } from '../src/auth/session';
import { AppSignInScreen } from '../src/features/auth/AppSignInScreen';
import { HomeCatalogScreen } from '../src/features/catalog/HomeCatalogScreen';
import { HomeWalletButton } from '../src/features/wallet/HomeWalletButton';
import { BottomNav } from '../src/ui/BottomNav';
import { colors } from '../src/ui/theme';

export default function HomeRoute(): JSX.Element {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSession);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const client = useMemo(() => createAppCatalogClient(), []);
  const progress = useMemo(() => createAppProgressClient(), []);
  const wallet = useMemo(() => createAppWalletClient(), []);

  if (session === null) {
    return <AppSignInScreen onFinished={() => {}} />;
  }

  return (
    <View style={styles.screen}>
      <HomeCatalogScreen
        client={client}
        signedIn
        walletShortcut={
          <HomeWalletButton
            key={revision}
            owner={revision}
            client={wallet}
            onPress={() => router.push('/coins')}
          />
        }
        onOpenSignIn={() => router.push('/sign-in')}
        onOpenAccount={() => router.push('/account')}
        onResumeEpisode={(episodeId) => router.push(`/play/${episodeId}`)}
        onSelectSeries={(seriesId) => router.push(`/series/${seriesId}`)}
        progress={progress}
      />
      <BottomNav
        active="browse"
        onNavigate={(tab) => router.push(tab === 'coins' ? '/coins' : '/account')}
      />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
