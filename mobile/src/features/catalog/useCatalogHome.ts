import { useCallback, useEffect, useState } from 'react';

import type { CatalogClient, CatalogHome } from '../../api/catalog/types';

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
  const [state, setState] = useState<CatalogHomeState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void client.getHome().then((result) => {
      if (!active) {
        return;
      }
      if (result.outcome === 'ok') {
        setState(
          hasEligibleSeries(result.data)
            ? { phase: 'loaded', home: result.data }
            : { phase: 'empty' },
        );
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
  }, [client, attempt]);

  return { state, refresh };
}
