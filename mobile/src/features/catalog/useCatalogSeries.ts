import { useCallback, useEffect, useState } from 'react';

import type { CatalogClient, CatalogSeriesDetail } from '../../api/catalog/types';

export type CatalogSeriesState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'not-found' }
  | { readonly phase: 'loaded'; readonly series: CatalogSeriesDetail };

export interface CatalogSeriesQuery {
  readonly state: CatalogSeriesState;
  readonly refresh: () => void;
}

export function useCatalogSeries(client: CatalogClient, publicId: string): CatalogSeriesQuery {
  const [state, setState] = useState<CatalogSeriesState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void client.getSeries(publicId).then((result) => {
      if (!active) {
        return;
      }
      if (result.outcome === 'ok') {
        setState({ phase: 'loaded', series: result.data });
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
