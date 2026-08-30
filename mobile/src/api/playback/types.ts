/**
 * Mobile playback authorize outcomes mapped through the generated OpenAPI client.
 *
 * Django remains the authorizer; this client never holds Bunny keys. HTTP 200
 * is narrowed on `decision`: granted is playable, locked is not success.
 */

import type { components } from '@shortform/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type PlaybackAuthorizeGranted = components['schemas']['PlaybackAuthorizeGranted'];
export type PlaybackAuthorizeLocked = components['schemas']['PlaybackAuthorizeLocked'];
export type PlaybackAuthorizeResponse = components['schemas']['PlaybackAuthorizeResponse'];

export type PlaybackLockReason = PlaybackAuthorizeLocked['lock_reasons'][number];

export type PlaybackRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: PlaybackAuthorizeGranted }
  | { readonly outcome: 'locked'; readonly lockReasons: readonly PlaybackLockReason[] }
  | EnvelopeOutcome<'unauthenticated' | 'error' | 'not-found' | 'unavailable'>
  | UnreachableOutcome;

export interface PlaybackClient {
  authorize(episodeId: string): Promise<PlaybackRequestOutcome>;
}
