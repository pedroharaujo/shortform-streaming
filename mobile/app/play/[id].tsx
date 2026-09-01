import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppPlayerClients } from '../../src/api/createAppClients';
import { getAppAnalyticsRuntime } from '../../src/analytics/appAnalytics';
import { readRouteId } from '../../src/features/catalog/readRouteId';
import { PlayerScreen } from '../../src/features/playback/PlayerScreen';
import { createPlaybackAnalytics } from '../../src/features/playback/playbackAnalytics';

export default function PlayerRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const { catalog, playback, progress } = useMemo(() => createAppPlayerClients(), []);
  const analytics = useMemo(() => createPlaybackAnalytics(getAppAnalyticsRuntime()), []);

  return (
    <PlayerScreen
      analytics={analytics}
      catalog={catalog}
      episodeId={episodeId}
      onClose={() => router.back()}
      onReward={(id) => router.replace({ pathname: '/reward/[id]', params: { id } })}
      playback={playback}
      progress={progress}
    />
  );
}
