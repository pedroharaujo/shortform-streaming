import type { components } from '@shortform/api-client';
import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type Wallet = components['schemas']['Wallet'];
export type CoinUnlock = components['schemas']['CoinUnlock'];
export type CoinUnlockRequest = Readonly<components['schemas']['CoinUnlockRequestRequest']>;
export type WalletOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | EnvelopeOutcome<'error' | 'unauthenticated' | 'unavailable' | 'not-found'>
  | UnreachableOutcome;

export interface WalletClient {
  getWallet(): Promise<WalletOutcome<Wallet>>;
  unlock(request: CoinUnlockRequest): Promise<WalletOutcome<CoinUnlock>>;
}
