import type { components } from '@shortform/api-client';
export type PurchaseIdentity = components['schemas']['PurchaseIdentity'];
export type PurchaseCatalog = components['schemas']['PurchaseCatalog'];
export type PurchaseStatus = components['schemas']['PurchaseStatus'];
export type PurchaseStatusRequest = components['schemas']['PurchaseStatusRequestRequest'];
export type CheckoutOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | { readonly outcome: 'unavailable'; readonly message: string };
export interface PurchaseCheckoutClient {
  getIdentity(): Promise<CheckoutOutcome<PurchaseIdentity>>;
  getCatalog(applicationId: string): Promise<CheckoutOutcome<PurchaseCatalog>>;
  getStatus(request: PurchaseStatusRequest): Promise<CheckoutOutcome<PurchaseStatus>>;
}
