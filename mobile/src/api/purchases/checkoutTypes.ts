import type { components } from '@stovio/api-client';
export type PurchaseIdentity = components['schemas']['PurchaseIdentity'];
export type PurchaseCatalog = components['schemas']['PurchaseCatalog'];
export type PurchaseStatus = components['schemas']['PurchaseStatus'];
export type PurchaseStatusRequest = components['schemas']['PurchaseStatusRequestRequest'];
export type PurchaseRecoveryRequest = components['schemas']['PurchaseRecoveryRequestRequest'];
/** Server-managed pack presentation; the store supplies the price. */
export interface PackPresentation {
  readonly productId: string;
  readonly coins: number;
  readonly bonusPercent: number;
  readonly badge: string;
  readonly highlighted: boolean;
}
export type CheckoutOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | { readonly outcome: 'unavailable'; readonly message: string };
export interface PurchaseCheckoutClient {
  getIdentity(): Promise<CheckoutOutcome<PurchaseIdentity>>;
  getCatalog(applicationId: string): Promise<CheckoutOutcome<PurchaseCatalog>>;
  getStatus(request: PurchaseStatusRequest): Promise<CheckoutOutcome<PurchaseStatus>>;
  sync(request: PurchaseStatusRequest): Promise<CheckoutOutcome<PurchaseStatus>>;
  recover(request: PurchaseRecoveryRequest): Promise<CheckoutOutcome<PurchaseStatus>>;
}
