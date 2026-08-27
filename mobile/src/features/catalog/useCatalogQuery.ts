import { useCallback, useEffect, useState } from 'react';

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
