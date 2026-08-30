import type { components, paths } from '@shortform/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type AccountProfile = components['schemas']['CurrentUserProfile'];
export type AccountPreferences = Required<
  components['schemas']['PatchedAccountPreferencesRequest']
>;
export type AccountDeletion =
  paths['/v1/me/deletion']['post']['responses'][202]['content']['application/json'];

export type AccountOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | EnvelopeOutcome<'unauthenticated' | 'error'>
  | UnreachableOutcome;

export interface AccountClient {
  getProfile(): Promise<AccountOutcome<AccountProfile>>;
  updatePreferences(
    preferences: Partial<AccountPreferences>,
  ): Promise<AccountOutcome<AccountProfile>>;
  deleteAccount(): Promise<AccountOutcome<AccountDeletion>>;
  requestExport(): Promise<AccountOutcome<unknown>>;
}
