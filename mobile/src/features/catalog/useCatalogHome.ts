import { useCallback } from 'react';

import type { CatalogClient, CatalogHome } from '../../api/catalog/types';
import { useCatalogQuery } from './useCatalogQuery';

export type CatalogHomeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'empty' }
  | { readonly phase: 'loaded'; readonly home: CatalogHome };

export interface CatalogHomeQuery {
  readonly state: CatalogHomeState;
  readonly refresh: () => void;
}

function hasEligibleSeries(home: CatalogHome): boolean {
  return home.rails.some((rail) => rail.series.length > 0);
}

export function useCatalogHome(client: CatalogClient): CatalogHomeQuery {
  const load = useCallback(async (): Promise<CatalogHomeState> => {
    const result = await client.getHome();
    if (result.outcome === 'ok') {
      return hasEligibleSeries(result.data)
        ? { phase: 'loaded', home: result.data }
        : { phase: 'empty' };
    }
    if (result.outcome === 'unreachable') {
      return { phase: 'error', message: result.reason };
    }
    return { phase: 'error', message: result.message };
  }, [client]);

  return useCatalogQuery(load);
}
