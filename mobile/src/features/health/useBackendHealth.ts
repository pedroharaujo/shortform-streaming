import { useCallback } from 'react';

import type { BackendHealthSnapshot, HealthClient } from '../../api/health/types';
import { useCatalogQuery } from '../catalog/useCatalog';

export type BackendHealthState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'loaded'; readonly snapshot: BackendHealthSnapshot };

export interface BackendHealth {
  readonly state: BackendHealthState;
  readonly refresh: () => void;
}

export function useBackendHealth(client: HealthClient): BackendHealth {
  const load = useCallback(async (): Promise<BackendHealthState> => {
    const snapshot = await client.probeAll();
    return { phase: 'loaded', snapshot };
  }, [client]);

  return useCatalogQuery(load);
}
