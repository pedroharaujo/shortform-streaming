import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
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
});
