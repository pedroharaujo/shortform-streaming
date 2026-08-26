import { useCallback, useEffect, useState } from 'react';

import type { PlaybackAuthorizeResponse, PlaybackClient } from '../../api/playback/types';

export type PlaybackAuthorizeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'loaded'; readonly playbackUrl: string; readonly expiresAt: string };

export interface PlaybackAuthorizeQuery {
  readonly state: PlaybackAuthorizeState;
  readonly refresh: () => void;
}

export function usePlaybackAuthorize(
  client: PlaybackClient,
  episodeId: string,
): PlaybackAuthorizeQuery {
  const [state, setState] = useState<PlaybackAuthorizeState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (episodeId === '') {
      return;
    }
    let active = true;
    void client.authorize(episodeId).then((result) => {
      if (!active) {
        return;
      }
      if (result.outcome === 'ok') {
        const authorized: PlaybackAuthorizeResponse = result.data;
        setState({
          phase: 'loaded',
          playbackUrl: authorized.playback_url,
          expiresAt: authorized.expires_at,
        });
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
  }, [client, episodeId, attempt]);

  const resolvedState: PlaybackAuthorizeState =
    episodeId === ''
      ? { phase: 'error', message: 'Episode id is required for the playback spike.' }
      : state;

  return { state: resolvedState, refresh };
}
