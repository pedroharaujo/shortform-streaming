import { useCallback } from 'react';

import type { CatalogClient, CatalogSeriesDetail } from '../../api/catalog/types';
import { useCatalogQuery } from './useCatalogQuery';

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
  const load = useCallback(async (): Promise<CatalogSeriesState> => {
    const result = await client.getSeries(publicId);
    if (result.outcome === 'ok') {
      return { phase: 'loaded', series: result.data };
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
