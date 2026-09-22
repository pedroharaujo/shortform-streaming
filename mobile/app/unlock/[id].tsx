import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type JSX } from 'react';
import { Platform } from 'react-native';
import {
  createAppCatalogClient,
  createAppMeClient,
  createAppPlaybackClient,
  createAppRewardsClient,
  createAppWalletClient,
} from '../../src/api/createAppClients';
import { getSessionCredential } from '../../src/auth/session';
import {
  getAdsConfiguration,
  getApiConfiguration,
  getPurchaseConfiguration,
} from '../../src/config/appConfiguration';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { EpisodeUnlockScreen } from '../../src/features/wallet/EpisodeUnlockScreen';

export default function UnlockRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const environment = getApiConfiguration().environment;
  const coinsEnabled =
    Platform.OS === 'android' &&
    (environment === 'local' ||
      (environment === 'staging' && getPurchaseConfiguration().mode === 'revenuecat_sandbox'));
  const clients = useMemo(
    () => ({
      catalog: createAppCatalogClient(),
      me: createAppMeClient(),
      rewards: createAppRewardsClient(),
      wallet: createAppWalletClient(),
      playback: createAppPlaybackClient({ getCredential: getSessionCredential }),
    }),
    [],
  );
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  return (
    <EpisodeUnlockScreen
      key={`${episodeId}:${visit}`}
      {...clients}
      episodeId={episodeId}
      adsEnabled={getAdsConfiguration().mode !== 'disabled'}
      coinsEnabled={coinsEnabled}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/episodes/[id]', params: { id: episodeId } });
      }}
      onAccount={() =>
        router.replace({
          pathname: getSessionCredential() === null ? '/sign-in' : '/account',
          params: { returnEpisode: episodeId },
        })
      }
      onWallet={() => router.push({ pathname: '/coins', params: { returnEpisode: episodeId } })}
      onAd={(id) => router.replace({ pathname: '/reward/[id]', params: { id } })}
      onPlay={(id) => router.replace({ pathname: '/play/[id]', params: { id } })}
    />
  );
}
