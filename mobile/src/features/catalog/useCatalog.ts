import { useCallback, useEffect, useState } from 'react';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogHome,
  CatalogSeriesDetail,
} from '../../api/catalog/types';

export interface CatalogQuery<TState> {
  readonly state: TState;
  readonly refresh: () => void;
}

export function useCatalogQuery<TState>(load: () => Promise<TState>): CatalogQuery<TState> {
  const [state, setState] = useState<TState>({ phase: 'loading' } as TState);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' } as TState);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (!active) {
        return;
      }
      setState(next);
    });
    return () => {
      active = false;
    };
  }, [attempt, load]);

  return { state, refresh };
}

export type CatalogHomeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly kind: 'request' | 'unreachable' }
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
      return { phase: 'error', kind: 'unreachable' };
    }
    return { phase: 'error', kind: 'request' };
  }, [client]);

  return useCatalogQuery(load);
}

export type CatalogSeriesState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly kind: 'request' | 'unreachable' }
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
      return { phase: 'error', kind: 'unreachable' };
    }
    return { phase: 'error', kind: 'request' };
  }, [client, publicId]);

  return useCatalogQuery(load);
}

export type CatalogEpisodeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly kind: 'request' | 'unreachable' }
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
      return { phase: 'error', kind: 'unreachable' };
    }
    return { phase: 'error', kind: 'request' };
  }, [client, publicId]);

  return useCatalogQuery(load);
}
