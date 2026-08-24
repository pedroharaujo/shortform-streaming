import { useCallback, useEffect, useState } from 'react';

import type { CatalogClient, CatalogEpisodeDetail } from '../../api/catalog/types';

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
  const [state, setState] = useState<CatalogEpisodeState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void client.getEpisode(publicId).then((result) => {
      if (!active) {
        return;
      }
      if (result.outcome === 'ok') {
        setState({ phase: 'loaded', episode: result.data });
        return;
      }
      if (result.outcome === 'not-found') {
        setState({ phase: 'not-found' });
        return;
      }
      if (result.outcome === 'unreachable') {
        setState({ phase: 'error', message: result.reason });
        return;
      }
      setState({ phase: 'error', message: result.message });
    });
    return () => {
      active = false;
    };
  }, [client, publicId, attempt]);

  return { state, refresh };
}
