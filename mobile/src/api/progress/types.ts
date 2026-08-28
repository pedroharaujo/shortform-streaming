/**
 * Watch progress mapped through the generated OpenAPI client.
 *
 * Catalog context headers plus optional Firebase Bearer. Anonymous requests
 * send X-Device-Id only. The JSON body never includes a playback URL.
 */

import type { components } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';

export const PROGRESS_LANGUAGE = 'en';

export type WatchProgress = components['schemas']['WatchProgress'];

export interface WatchProgressWrite {
  readonly position_seconds: number;
  readonly completed?: boolean;
}

export type ProgressRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: WatchProgress }
  | {
      readonly outcome: 'locked';
      readonly httpStatus: 403;
      readonly code: string;
      readonly message: string;
    }
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
  | { readonly outcome: 'unreachable'; readonly reason: string };

export interface ProgressClient {
  get(episodeId: string): Promise<ProgressRequestOutcome>;
  put(episodeId: string, body: WatchProgressWrite): Promise<ProgressRequestOutcome>;
}

export type { CatalogPlatform };
