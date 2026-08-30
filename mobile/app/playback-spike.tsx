import { Redirect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppPlaybackClient } from '../src/api/createAppClients';
import { readRouteId } from '../src/features/catalog/readRouteId';
import { PlaybackSpikeScreen } from '../src/features/playback/PlaybackSpikeScreen';

export default function PlaybackSpikeRoute(): JSX.Element {
  const params = useLocalSearchParams<{ episodeId?: string | string[] }>();
  const episodeId = readRouteId(params.episodeId);
  const client = useMemo(() => createAppPlaybackClient(), []);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <PlaybackSpikeScreen client={client} episodeId={episodeId} />;
}
