/**
 * Mobile playback authorize outcomes mapped through the generated OpenAPI client.
 *
 * HTTP paths and JSON bodies come from `@shortform/api-client`. Django remains
 * the authorizer; this client never holds Bunny keys. HTTP 200 is narrowed on
 * `decision`: granted is playable, locked is not success.
 */

import type { components } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';

export const PLAYBACK_LANGUAGE = 'en';

export type PlaybackAuthorizeGranted = components['schemas']['PlaybackAuthorizeGranted'];
export type PlaybackAuthorizeLocked = components['schemas']['PlaybackAuthorizeLocked'];
export type PlaybackAuthorizeResponse = components['schemas']['PlaybackAuthorizeResponse'];

export type PlaybackLockReason = PlaybackAuthorizeLocked['lock_reasons'][number];

export type PlaybackRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: PlaybackAuthorizeGranted }
  | { readonly outcome: 'locked'; readonly lockReasons: readonly PlaybackLockReason[] }
  | {
      readonly outcome: 'unauthenticated';
      readonly httpStatus: 401;
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'error';
      readonly httpStatus: number;
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'not-found';
      readonly httpStatus: 404;
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'unavailable';
      readonly httpStatus: 503;
      readonly code: string;
      readonly message: string;
    }
  | { readonly outcome: 'unreachable'; readonly reason: string };

export interface PlaybackClient {
  authorize(episodeId: string): Promise<PlaybackRequestOutcome>;
}

export type { CatalogPlatform };
