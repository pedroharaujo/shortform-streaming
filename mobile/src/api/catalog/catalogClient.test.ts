import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { createCatalogClient } from './catalogClient';

const BASE_URL = 'http://10.0.2.2:8000';

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
        },
      ],
    },
  ],
};

describe('createCatalogClient', () => {
  it('uses the fixed MVP catalog without client-controlled market headers', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(homeBody, 200),
    );
    const client = createCatalogClient({
      baseUrl: BASE_URL,
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await client.getHome();

    const [input, init] = performRequest.mock.calls[0] ?? [];
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('X-Territory')).toBeNull();
    expect(headers.get('X-Platform')).toBeNull();
    expect(headers.get('X-Language')).toBeNull();
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('Accept-Language')).toBeNull();
    expect(requestUrl(input as RequestInfo | URL)).toBe(`${BASE_URL}/v1/catalog/home`);
  });

  it('maps HTTP 404 to not-found, never locked', async () => {
    const client = createCatalogClient({
      baseUrl: BASE_URL,
      fetchImplementation: (async () =>
        jsonResponse(
          { code: 'not_found', message: 'Resource not found.', request_id: 'req-404' },
          404,
        )) as typeof fetch,
    });

    const result = await client.getSeries('ser_missing');
    expect(result).toEqual({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    });
  });
});
