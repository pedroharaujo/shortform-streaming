import { router, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppCatalogClient } from '../../src/features/catalog/createAppCatalogClient';
import { EpisodeSelectedScreen } from '../../src/features/catalog/EpisodeSelectedScreen';
import { readRouteId } from '../../src/features/catalog/readRouteId';

export default function EpisodeSelectedRoute(): JSX.Element {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const episodeId = readRouteId(params.id);
  const client = useMemo(() => createAppCatalogClient(), []);

  return (
    <EpisodeSelectedScreen
      client={client}
      episodeId={episodeId}
      onBack={() => router.back()}
      onPlay={(id) => router.push(`/play/${id}`)}
    />
  );
}
