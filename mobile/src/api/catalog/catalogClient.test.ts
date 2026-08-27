import { abortSignal, jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { createCatalogClient } from './catalogClient';
import { CATALOG_LANGUAGE } from './types';

const BASE_URL = 'http://10.0.2.2:8000';
const TERRITORY = 'FR';
const PLATFORM = 'ios' as const;

const homeBody = {
  rails: [
    {
      id: 'featured',
      title: 'Featured',
      series: [
        {
          id: 'ser_harbor',
          title: 'Harbor Lights',
          synopsis: 'Synthetic FR-only English microdrama for local catalog tests.',
          artwork_url: null,
          original_language: 'en',
        },
      ],
    },
  ],
};

function createClient(performRequest: typeof fetch) {
  return createCatalogClient({
    baseUrl: BASE_URL,
    territory: TERRITORY,
    platform: PLATFORM,
    fetchImplementation: performRequest,
  });
}

describe('createCatalogClient', () => {
  it('sends catalog context headers and never Authorization or Accept-Language', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(homeBody, 200),
    );
    const client = createClient(performRequest as unknown as typeof fetch);

    await client.getHome();

    expect(performRequest).toHaveBeenCalled();
    const [input, init] = performRequest.mock.calls[0] ?? [];
    expect(input).toBeDefined();
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('X-Territory')).toBe(TERRITORY);
    expect(headers.get('X-Platform')).toBe(PLATFORM);
    expect(headers.get('X-Language')).toBe(CATALOG_LANGUAGE);
    expect(headers.get('X-Language')).toBe('en');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('Accept-Language')).toBeNull();
    expect(requestUrl(input as RequestInfo | URL)).toBe(`${BASE_URL}/v1/catalog/home`);
  });

  it('freezes X-Language to en on series and episode reads', async () => {
    const performRequest = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('/v1/series/')) {
        return jsonResponse(
          {
            id: 'ser_harbor',
            title: 'Harbor Lights',
            synopsis: 'Synthetic synopsis.',
            artwork_url: null,
            original_language: 'en',
            genres: [],
            seasons: [],
          },
          200,
        );
      }
      return jsonResponse(
        {
          id: 'ep_harbor_1',
          title: 'Harbor Lights · Episode 1',
          synopsis: 'Synthetic episode synopsis.',
          duration_seconds: 90,
          order: 1,
          series_id: 'ser_harbor',
          season_number: 1,
        },
        200,
      );
    });
    const client = createClient(performRequest as unknown as typeof fetch);

    await client.getSeries('ser_harbor');
    await client.getEpisode('ep_harbor_1');

    for (const [input, init] of performRequest.mock.calls) {
      const headers = requestHeaders(input, init);
      expect(headers.get('X-Language')).toBe('en');
      expect(headers.get('Accept-Language')).toBeNull();
      expect(headers.get('Authorization')).toBeNull();
    }
    const urls = performRequest.mock.calls.map(([input]) => requestUrl(input));
    expect(urls).toEqual([
      `${BASE_URL}/v1/series/ser_harbor`,
      `${BASE_URL}/v1/episodes/ep_harbor_1`,
    ]);
  });

  it('maps HTTP 400 to an error outcome', async () => {
    const client = createClient((async () =>
      jsonResponse(
        {
          code: 'invalid_request_context',
          message: 'X-Territory, X-Platform, and X-Language are required.',
          request_id: 'req-400',
        },
        400,
      )) as typeof fetch);

    await expect(client.getHome()).resolves.toEqual({
      outcome: 'error',
      httpStatus: 400,
      code: 'invalid_request_context',
      message: 'X-Territory, X-Platform, and X-Language are required.',
    });
  });

  it('maps HTTP 404 to not-found, never locked', async () => {
    const client = createClient((async () =>
      jsonResponse(
        { code: 'not_found', message: 'Resource not found.', request_id: 'req-404' },
        404,
      )) as typeof fetch);

    const result = await client.getSeries('ser_missing');
    expect(result).toEqual({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    });
    expect(result.outcome).not.toBe('locked');
    expect(JSON.stringify(result).toLowerCase()).not.toContain('locked');
  });

  it('maps an unreachable backend instead of throwing', async () => {
    const client = createClient((async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch);

    await expect(client.getHome()).resolves.toEqual({
      outcome: 'unreachable',
      reason: 'Network request failed',
    });
  });

  it('reports a timeout when the request is aborted', async () => {
    const client = createCatalogClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      timeoutMs: 1,
      fetchImplementation: ((input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal(input, init)?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })) as unknown as typeof fetch,
    });

    await expect(client.getHome()).resolves.toEqual({
      outcome: 'unreachable',
      reason: 'timeout',
    });
  });
});
