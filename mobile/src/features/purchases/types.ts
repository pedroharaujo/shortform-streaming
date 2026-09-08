import type { PurchaseCheckoutClient } from '../../api/purchases/checkoutTypes';
import type { Wallet, WalletClient } from '../../api/wallet/types';
import type { PendingPurchaseStorage } from './pendingPurchaseAttempt';
export interface CheckoutOffer {
  readonly productId: string;
  readonly coins: number;
  readonly price: string;
}
export type CheckoutState =
  | {
      readonly status:
        | 'unavailable'
        | 'busy'
        | 'session_changed'
        | 'storage_unavailable'
        | 'awaiting_verification'
        | 'cancelled';
    }
  | { readonly status: 'ready'; readonly offers: readonly CheckoutOffer[] }
  | {
      readonly status: 'review_required';
      readonly historicalCreditedCoins: number;
      readonly supportReference: string;
    }
  | {
      readonly status: 'credited';
      readonly historicalCreditedCoins: number;
      readonly supportReference: string;
      readonly wallet:
        | { readonly status: 'available'; readonly data: Wallet }
        | { readonly status: 'unavailable' };
    };
export interface CheckoutCoordinator {
  load(): Promise<CheckoutState>;
  purchase(productId: string): Promise<CheckoutState>;
  sync(): Promise<CheckoutState>;
}
export interface ProviderIdentity {
  readonly ownerId: string;
  readonly applicationId: string;
}
export interface ProviderPurchase extends ProviderIdentity {
  readonly productId: string;
  readonly store: 'PLAY_STORE';
  readonly environment: 'SANDBOX';
}
/** Synthetic adapter only. Runtime-validate outputs; no provider payload reaches public state. */
export interface SyntheticPurchaseProvider {
  prepare(identity: ProviderIdentity): Promise<unknown>;
  getOffers(identity: ProviderIdentity): Promise<unknown>;
  purchase(request: ProviderPurchase): Promise<unknown>;
}
export interface CheckoutDependencies {
  readonly mode: 'disabled' | 'synthetic';
  readonly environment: string;
  readonly development: boolean;
  readonly applicationId: string;
  readonly api: PurchaseCheckoutClient;
  readonly wallet: Pick<WalletClient, 'getWallet'>;
  readonly provider: SyntheticPurchaseProvider;
  readonly storage: PendingPurchaseStorage;
}
