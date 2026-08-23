import { useCallback, useEffect, useState } from 'react';

import type { BackendHealthSnapshot, HealthClient } from '../../api/health/types';

export type BackendHealthState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'loaded'; readonly snapshot: BackendHealthSnapshot };

export interface BackendHealth {
  readonly state: BackendHealthState;
  readonly refresh: () => void;
}

export function useBackendHealth(client: HealthClient): BackendHealth {
  const [state, setState] = useState<BackendHealthState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void client.probeAll().then((snapshot) => {
      if (active) {
        setState({ phase: 'loaded', snapshot });
      }
    });
    return () => {
      active = false;
    };
  }, [client, attempt]);

  return { state, refresh };
}
