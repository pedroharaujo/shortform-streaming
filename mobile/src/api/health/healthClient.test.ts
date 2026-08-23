import { createHealthClient } from './healthClient';

const BASE_URL = 'http://10.0.2.2:8000';

function jsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('createHealthClient', () => {
  it('requests the documented health paths', async () => {
    const performRequest = jest.fn(async () => jsonResponse({ status: 'ok' }, 200));
    const client = createHealthClient({
      baseUrl: BASE_URL,
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await client.probeAll();

    const requested = performRequest.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(requested).toEqual(
      expect.arrayContaining([`${BASE_URL}/health/live`, `${BASE_URL}/health/ready`]),
    );
  });

  it('reports an available probe', async () => {
    const client = createHealthClient({
      baseUrl: BASE_URL,
      fetchImplementation: (async () => jsonResponse({ status: 'ok' }, 200)) as typeof fetch,
    });

    await expect(client.probe('liveness')).resolves.toEqual({
      outcome: 'available',
      probe: 'liveness',
      status: 'ok',
    });
  });

  it('reports readiness failure returned as HTTP 503', async () => {
    const client = createHealthClient({
      baseUrl: BASE_URL,
      fetchImplementation: (async () =>
        jsonResponse({ status: 'unavailable' }, 503)) as typeof fetch,
    });

    await expect(client.probe('readiness')).resolves.toEqual({
      outcome: 'unavailable',
      probe: 'readiness',
      httpStatus: 503,
      status: 'unavailable',
    });
  });

  it('reports an unreachable backend instead of throwing', async () => {
    const client = createHealthClient({
      baseUrl: BASE_URL,
      fetchImplementation: (async () => {
        throw new TypeError('Network request failed');
      }) as typeof fetch,
    });

    await expect(client.probe('liveness')).resolves.toEqual({
      outcome: 'unreachable',
      probe: 'liveness',
      reason: 'Network request failed',
    });
  });

  it('reports a timeout when the request is aborted', async () => {
    const client = createHealthClient({
      baseUrl: BASE_URL,
      timeoutMs: 1,
      fetchImplementation: ((_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })) as unknown as typeof fetch,
    });

    await expect(client.probe('readiness')).resolves.toEqual({
      outcome: 'unreachable',
      probe: 'readiness',
      reason: 'timeout',
    });
  });

  it('degrades to an unknown status when the body is not valid JSON', async () => {
    const client = createHealthClient({
      baseUrl: BASE_URL,
      fetchImplementation: (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        }) as unknown as Response) as typeof fetch,
    });

    await expect(client.probe('liveness')).resolves.toEqual({
      outcome: 'available',
      probe: 'liveness',
      status: 'unknown',
    });
  });
});
