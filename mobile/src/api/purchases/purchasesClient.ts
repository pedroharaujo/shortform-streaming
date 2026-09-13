import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type { PurchaseHistory, PurchaseHistoryItem, PurchasesClient } from './types';

const MAX_COIN_CREDIT = 2147483647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordedAt(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = ISO_DATETIME_PATTERN.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

function isHistoryItem(value: unknown): value is PurchaseHistoryItem {
  return (
    isRecord(value) &&
    isRecordedAt(value.recorded_at) &&
    typeof value.historical_credited_coins === 'number' &&
    Number.isInteger(value.historical_credited_coins) &&
    value.historical_credited_coins > 0 &&
    value.historical_credited_coins <= MAX_COIN_CREDIT &&
    typeof value.support_reference === 'string' &&
    UUID_PATTERN.test(value.support_reference) &&
    (value.status === 'credited' || value.status === 'review_required')
  );
}

function isHistory(value: unknown): value is PurchaseHistory {
  if (
    !isRecord(value) ||
    !Array.isArray(value.purchases) ||
    value.purchases.length > 20 ||
    typeof value.has_more !== 'boolean' ||
    !value.purchases.every(isHistoryItem)
  )
    return false;
  if (value.has_more && value.purchases.length !== 20) return false;
  const references = value.purchases.map((purchase) => purchase.support_reference.toLowerCase());
  return new Set(references).size === references.length;
}

export function createPurchasesClient(options: {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly fetchImplementation?: typeof fetch;
}): PurchasesClient {
  const api = createOpenApiClient(options);
  const message = 'The purchase history request could not be completed.';
  return {
    async getHistory() {
      const result = await mapJsonRequest<PurchaseHistory>(DEFAULT_TIMEOUT_MS, message, (signal) =>
        api.GET('/v1/purchases/history', { headers: bearerHeaders(options.getCredential), signal }),
      );
      if (result.outcome === 'ok') {
        if (!isHistory(result.data))
          return {
            outcome: 'error',
            httpStatus: 200,
            code: 'invalid_response',
            message,
          };
        // Keep only the public contract; provider fields never leave this boundary.
        return {
          outcome: 'ok',
          data: {
            has_more: result.data.has_more,
            purchases: result.data.purchases.map(
              ({ recorded_at, historical_credited_coins, support_reference, status }) => ({
                recorded_at,
                historical_credited_coins,
                support_reference,
                status,
              }),
            ),
          },
        };
      }
      if (result.outcome === 'unreachable') return { outcome: 'unreachable', reason: message };
      return {
        outcome: result.status === 401 ? 'unauthenticated' : 'unavailable',
        httpStatus: result.status,
        code: 'history_unavailable',
        message,
      };
    },
  };
}
