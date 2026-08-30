import type { components } from '@shortform/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type CurrentUserProfile = components['schemas']['CurrentUserProfile'];

export type MeRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: CurrentUserProfile }
  | EnvelopeOutcome<'unauthenticated' | 'error'>
  | UnreachableOutcome;

export interface MeClient {
  getMe(): Promise<MeRequestOutcome>;
}
