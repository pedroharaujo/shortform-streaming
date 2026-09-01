import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  createAppCatalogClient,
  createAppMeClient,
  createAppPlaybackClient,
  createAppRewardsClient,
} from '../../src/api/createAppClients';
import { getAppAnalyticsRuntime } from '../../src/analytics/appAnalytics';
import { getSessionCredential } from '../../src/auth/session';
import { getApiConfiguration, getRewardedAdUnitId } from '../../src/config/appConfiguration';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { RewardScreen } from '../../src/features/rewards/RewardScreen';
import { createRewardAnalytics } from '../../src/features/rewards/rewardAnalytics';
import { createTestAdPresenter } from '../../src/features/rewards/testAdPresenter';

export default function RewardRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const { environment } = getApiConfiguration();
  const clients = useMemo(
    () => ({
      catalog: createAppCatalogClient(),
      me: createAppMeClient(),
      rewards: createAppRewardsClient(),
      playback: createAppPlaybackClient({ getCredential: getSessionCredential }),
    }),
    [],
  );
  const presenter = useMemo(
    () => createTestAdPresenter(environment, Platform.OS, getRewardedAdUnitId()),
    [environment],
  );
  const analytics = useMemo(() => createRewardAnalytics(getAppAnalyticsRuntime()), []);
  return (
    <RewardScreen
      key={episodeId}
      {...clients}
      episodeId={episodeId}
      analytics={analytics}
      presenter={presenter}
      enabled={environment !== 'production' && Platform.OS === 'android'}
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
      onPlay={(id) => router.replace({ pathname: '/play/[id]', params: { id } })}
    />
  );
}
