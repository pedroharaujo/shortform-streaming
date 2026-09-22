import type { components } from '@stovio/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type CurrentUserProfile = components['schemas']['CurrentUserProfile'];

export type MeRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: CurrentUserProfile }
  | EnvelopeOutcome<'unauthenticated' | 'error'>
  | UnreachableOutcome;

export interface MeClient {
  /** When `credential` is set, confirm that token before it is stored as the session. */
  getMe(credential?: string): Promise<MeRequestOutcome>;
}
