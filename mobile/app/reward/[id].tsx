import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  createAppCatalogClient,
  createAppMeClient,
  createAppRewardsClient,
} from '../../src/api/createAppClients';
import { getApiConfiguration, getRewardedAdUnitId } from '../../src/config/appConfiguration';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { RewardScreen } from '../../src/features/rewards/RewardScreen';
import { createTestAdPresenter } from '../../src/features/rewards/testAdPresenter';

export default function RewardRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { environment } = getApiConfiguration();
  const clients = useMemo(
    () => ({
      catalog: createAppCatalogClient(),
      me: createAppMeClient(),
      rewards: createAppRewardsClient(),
    }),
    [],
  );
  const presenter = useMemo(
    () => createTestAdPresenter(environment, Platform.OS, getRewardedAdUnitId()),
    [environment],
  );
  return (
    <RewardScreen
      key={readRouteId(params.id)}
      {...clients}
      episodeId={readRouteId(params.id)}
      presenter={presenter}
      enabled={environment !== 'production' && Platform.OS === 'android'}
      onClose={() => router.back()}
      onAccount={() => router.replace('/account')}
      onPlay={(id) => router.replace({ pathname: '/play/[id]', params: { id } })}
    />
  );
}
