import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppPlayerClients } from '../../src/api/createAppClients';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { PlayerScreen } from '../../src/features/playback/PlayerScreen';

export default function PlayerRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const { catalog, playback, progress } = useMemo(() => createAppPlayerClients(), []);

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
