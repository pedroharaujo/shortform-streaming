import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type {
  CoinUnlock,
  CoinUnlockResolution,
  Wallet,
  WalletClient,
  WalletOutcome,
} from './types';

const MAX_COIN_CHARGE = 2147483647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBalance(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isWallet(value: unknown): value is Wallet {
  return (
    isRecord(value) && isBalance(value.balance) && typeof value.spending_available === 'boolean'
  );
}

function isCoinUnlock(value: unknown): value is CoinUnlock {
  return (
    isRecord(value) &&
    typeof value.episode_id === 'string' &&
    PUBLIC_ID_PATTERN.test(value.episode_id) &&
    typeof value.request_id === 'string' &&
    UUID_PATTERN.test(value.request_id) &&
    isBalance(value.charged_coins) &&
    value.charged_coins <= MAX_COIN_CHARGE &&
    isBalance(value.balance)
  );
}

function isResolution(value: unknown): value is CoinUnlockResolution {
  return (
    isRecord(value) &&
    (value.status === 'completed' || (value.status === 'cancelled' && value.charged_coins === 0)) &&
    isCoinUnlock(value)
  );
}

function validateSuccess<T>(
  result: WalletOutcome<T>,
  validate: (value: unknown) => value is T,
): WalletOutcome<T> {
  if (result.outcome !== 'ok' || validate(result.data)) return result;
  return {
    outcome: 'error',
    httpStatus: 200,
    code: 'invalid_response',
    message: 'The wallet response could not be verified.',
  };
}

export function createWalletClient(options: {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly fetchImplementation?: typeof fetch;
}): WalletClient {
  const api = createOpenApiClient(options);
  const errorMap = {
    401: 'unauthenticated',
    404: 'not-found',
    409: 'unavailable',
    503: 'unavailable',
  } as const;
  const message = 'The wallet request could not be completed.';
  return {
    async resolve(request) {
      const result = mapJsonDomain(
        await mapJsonRequest<CoinUnlockResolution>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/coins/unlock/resolve', {
            body: request,
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
      return validateSuccess(result, isResolution);
    },
    async getWallet() {
      const result = mapJsonDomain(
        await mapJsonRequest<Wallet>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.GET('/v1/wallet', {
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
      return validateSuccess(result, isWallet);
    },
    async unlock(request) {
      const result = mapJsonDomain(
        await mapJsonRequest<CoinUnlock>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/coins/unlock', {
            body: request,
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
      return validateSuccess(result, isCoinUnlock);
    },
  };
}
