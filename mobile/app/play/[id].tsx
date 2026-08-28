import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { resolveCatalogPlatform } from '../../src/api/catalog/catalogClient';
import { createPlaybackClient } from '../../src/api/playback/playbackClient';
import { createProgressClient } from '../../src/api/progress/progressClient';
import { getSessionCredential } from '../../src/auth/session';
import { getApiConfiguration } from '../../src/config/appConfiguration';
import { getOrCreateDeviceId } from '../../src/device/deviceId';
import { createAppCatalogClient } from '../../src/features/catalog/createAppCatalogClient';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { PlayerScreen } from '../../src/features/playback/PlayerScreen';

export default function PlayerRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const configuration = useMemo(() => getApiConfiguration(), []);
  const catalog = useMemo(() => createAppCatalogClient(), []);
  const playback = useMemo(
    () =>
      createPlaybackClient({
        baseUrl: configuration.baseUrl,
        territory: configuration.catalogTerritory,
        platform: resolveCatalogPlatform(Platform.OS),
        getCredential: getSessionCredential,
      }),
    [configuration.baseUrl, configuration.catalogTerritory],
  );
  const progress = useMemo(
    () =>
      createProgressClient({
        baseUrl: configuration.baseUrl,
        territory: configuration.catalogTerritory,
        platform: resolveCatalogPlatform(Platform.OS),
        getCredential: getSessionCredential,
        getDeviceId: getOrCreateDeviceId,
      }),
    [configuration.baseUrl, configuration.catalogTerritory],
  );

  return (
    <PlayerScreen
      catalog={catalog}
      episodeId={episodeId}
      onClose={() => router.back()}
      playback={playback}
      progress={progress}
    />
  );
}
