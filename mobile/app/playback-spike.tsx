import { Redirect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { resolveCatalogPlatform } from '../src/api/catalog/catalogPlatform';
import { createPlaybackClient } from '../src/api/playback/playbackClient';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { PlaybackSpikeScreen } from '../src/features/playback/PlaybackSpikeScreen';

export default function PlaybackSpikeRoute(): JSX.Element {
  const params = useLocalSearchParams<{ episodeId?: string | string[] }>();
  const episodeId = readRouteId(params.episodeId);
  const configuration = useMemo(() => getApiConfiguration(), []);
  const client = useMemo(
    () =>
      createPlaybackClient({
        baseUrl: configuration.baseUrl,
        territory: configuration.catalogTerritory,
        platform: resolveCatalogPlatform(Platform.OS),
      }),
    [configuration.baseUrl, configuration.catalogTerritory],
  );

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <PlaybackSpikeScreen client={client} episodeId={episodeId} />;
}
