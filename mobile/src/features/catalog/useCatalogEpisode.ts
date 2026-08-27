import { useCallback } from 'react';

import type { CatalogClient, CatalogEpisodeDetail } from '../../api/catalog/types';
import { useCatalogQuery } from './useCatalogQuery';

export type CatalogEpisodeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'not-found' }
  | { readonly phase: 'loaded'; readonly episode: CatalogEpisodeDetail };

export interface CatalogEpisodeQuery {
  readonly state: CatalogEpisodeState;
  readonly refresh: () => void;
}

export function useCatalogEpisode(client: CatalogClient, publicId: string): CatalogEpisodeQuery {
  const load = useCallback(async (): Promise<CatalogEpisodeState> => {
    const result = await client.getEpisode(publicId);
    if (result.outcome === 'ok') {
      return { phase: 'loaded', episode: result.data };
    }
    if (result.outcome === 'not-found') {
      return { phase: 'not-found' };
    }
    if (result.outcome === 'unreachable') {
      return { phase: 'error', message: result.reason };
    }
    return { phase: 'error', message: result.message };
  }, [client, publicId]);

  return useCatalogQuery(load);
}
