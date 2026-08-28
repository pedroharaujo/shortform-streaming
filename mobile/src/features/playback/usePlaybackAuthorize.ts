import { useCallback } from 'react';

import type { PlaybackClient } from '../../api/playback/types';
import { useCatalogQuery } from '../catalog/useCatalog';

export type PlaybackAuthorizeState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'locked'; readonly reasons: readonly string[] }
  | { readonly phase: 'loaded'; readonly playbackUrl: string; readonly expiresAt: string };

export interface PlaybackAuthorizeQuery {
  readonly state: PlaybackAuthorizeState;
  readonly refresh: () => void;
}

const EMPTY_EPISODE_MESSAGE = 'Episode id is required for the playback spike.';
const MISSING_URL_MESSAGE = 'Playback authorization did not return a URL.';

export function usePlaybackAuthorize(
  client: PlaybackClient,
  episodeId: string,
): PlaybackAuthorizeQuery {
  const load = useCallback(async (): Promise<PlaybackAuthorizeState> => {
    if (episodeId === '') {
      return { phase: 'error', message: EMPTY_EPISODE_MESSAGE };
    }
    const result = await client.authorize(episodeId);
    if (result.outcome === 'ok') {
      if (result.data.playback_url === '') {
        return { phase: 'error', message: MISSING_URL_MESSAGE };
      }
      return {
        phase: 'loaded',
        playbackUrl: result.data.playback_url,
        expiresAt: result.data.expires_at,
      };
    }
    if (result.outcome === 'locked') {
      return { phase: 'locked', reasons: result.lockReasons };
    }
    if (result.outcome === 'unreachable') {
      return { phase: 'error', message: result.reason };
    }
    return { phase: 'error', message: result.message };
  }, [client, episodeId]);

  const { state, refresh } = useCatalogQuery(load);
  const resolvedState: PlaybackAuthorizeState =
    episodeId === '' ? { phase: 'error', message: EMPTY_EPISODE_MESSAGE } : state;

  return { state: resolvedState, refresh };
}
