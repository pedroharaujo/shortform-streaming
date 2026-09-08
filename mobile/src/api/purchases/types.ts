import type { components } from '@shortform/api-client';
import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type PurchaseHistory = components['schemas']['PurchaseHistory'];
export type PurchaseHistoryItem = components['schemas']['PurchaseHistoryItem'];
export type PurchaseHistoryOutcome =
  | { readonly outcome: 'ok'; readonly data: PurchaseHistory }
  | EnvelopeOutcome<'error' | 'unauthenticated' | 'unavailable'>
  | UnreachableOutcome;

export interface PurchasesClient {
  getHistory(): Promise<PurchaseHistoryOutcome>;
}
