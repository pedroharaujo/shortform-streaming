export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
// Match the backend's synthetic-only identifier grammar and absolute end bounds.
export function isSyntheticApplication(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    /^test\.synthetic\.[A-Za-z0-9_.:/-]*$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}
export function isSyntheticProduct(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    /^synthetic_[A-Za-z0-9_.:/-]*$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}
export function isTransactionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 200 &&
    /^[A-Za-z0-9_.:$/-]+$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}
export function isCoins(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;
}
