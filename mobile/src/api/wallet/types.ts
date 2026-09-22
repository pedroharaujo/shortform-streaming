import type { components } from '@stovio/api-client';
import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type Wallet = components['schemas']['Wallet'];
export type WalletActivity = components['schemas']['WalletActivity'];
export type CoinUnlock = components['schemas']['CoinUnlock'];
export type CoinUnlockResolution = components['schemas']['CoinUnlockResolution'];
export type CoinUnlockRequest = Readonly<components['schemas']['CoinUnlockRequestRequest']>;
export type WalletOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | EnvelopeOutcome<'error' | 'unauthenticated' | 'unavailable' | 'not-found'>
  | UnreachableOutcome;

export interface WalletClient {
  getWallet(): Promise<WalletOutcome<Wallet>>;
  getActivity(): Promise<WalletOutcome<WalletActivity>>;
  unlock(request: CoinUnlockRequest): Promise<WalletOutcome<CoinUnlock>>;
  resolve(request: CoinUnlockRequest): Promise<WalletOutcome<CoinUnlockResolution>>;
}
