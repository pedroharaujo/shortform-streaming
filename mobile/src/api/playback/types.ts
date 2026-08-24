/**
 * Mobile playback authorize outcomes mapped through the generated OpenAPI client.
 *
 * HTTP paths and JSON bodies come from `@shortform/api-client`. Django remains
 * the authorizer; this client never holds Bunny keys.
 */

import type { components } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';

export const PLAYBACK_LANGUAGE = 'en';

export type PlaybackAuthorizeResponse = components['schemas']['PlaybackAuthorizeResponse'];
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];

export type PlaybackRequestOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
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
  authorize(episodeId: string): Promise<PlaybackRequestOutcome<PlaybackAuthorizeResponse>>;
}

export type { CatalogPlatform };
