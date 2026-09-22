/**
 * Watch progress mapped through the generated OpenAPI client.
 *
 * Catalog context headers plus optional Firebase Bearer. Anonymous requests
 * send X-Device-Id only. The JSON body never includes a playback URL.
 */

import type { components } from '@stovio/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type WatchProgress = components['schemas']['WatchProgress'];
export type ContinueWatching = components['schemas']['ContinueWatching'];
export type ContinueWatchingItem = ContinueWatching['items'][number];

export interface WatchProgressWrite {
  readonly position_seconds: number;
  readonly completed?: boolean;
}

export type ProgressRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: WatchProgress }
  | EnvelopeOutcome<'locked' | 'unauthenticated' | 'error' | 'not-found'>
  | UnreachableOutcome;

export type ContinueWatchingOutcome =
  | { readonly outcome: 'ok'; readonly data: ContinueWatching }
  | EnvelopeOutcome<'unauthenticated' | 'error'>
  | UnreachableOutcome;

export interface ProgressClient {
  get(episodeId: string): Promise<ProgressRequestOutcome>;
  put(episodeId: string, body: WatchProgressWrite): Promise<ProgressRequestOutcome>;
  listContinue(): Promise<ContinueWatchingOutcome>;
}
