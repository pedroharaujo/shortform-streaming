export function readRouteId(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  const first = value?.[0];
  return typeof first === 'string' ? first : '';
}
