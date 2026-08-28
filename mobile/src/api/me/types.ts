import type { components } from '@shortform/api-client';

export type CurrentUserProfile = components['schemas']['CurrentUserProfile'];

export type MeRequestOutcome =
  | { readonly outcome: 'ok'; readonly data: CurrentUserProfile }
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
  | { readonly outcome: 'unreachable'; readonly reason: string };

export interface MeClient {
  getMe(): Promise<MeRequestOutcome>;
}
