import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { jsonResponse, requestHeaders, requestUrl } from '../../api/fetchTestUtils';
import { createPurchasesClient } from '../../api/purchases/purchasesClient';
import { getSessionCredential, setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { compactAndroidMetrics, renderWithSafeArea } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
import { PurchaseHistoryScreen } from './PurchaseHistoryScreen';

const row = {
  recorded_at: '2026-09-09T10:30:00.123456Z',
  historical_credited_coins: 100,
  support_reference: '11111111-1111-4111-8111-111111111111',
  status: 'credited',
};
const history = { purchases: [row], has_more: false };
const copy = () => englishMessages.purchases;

function pendingResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function setup(
  performRequest: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >(async () => jsonResponse(history, 200)),
) {
  const onBack = jest.fn();
  const onAccount = jest.fn();
  const onReturnToEpisode = jest.fn();
  const client = createPurchasesClient({
    baseUrl: 'https://api.example.test',
    getCredential: getSessionCredential,
    fetchImplementation: performRequest as typeof fetch,
  });
  return {
    performRequest,
    onBack,
    onAccount,
    onReturnToEpisode,
    rendered: renderWithSafeArea(
      <PurchaseHistoryScreen
        client={client}
        onBack={onBack}
        onAccount={onAccount}
        onReturnToEpisode={onReturnToEpisode}
      />,
      { metrics: compactAndroidMetrics },
    ),
  };
}

beforeEach(() => setAuthSession({ credential: 'mock.synthetic-purchase-owner' }));
afterEach(() => jest.restoreAllMocks());

it('fetches only owner history and shows historical credits, safe support references and navigation', async () => {
  const request = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
    jsonResponse(
      {
        purchases: [
          row,
          {
            ...row,
            support_reference: '22222222-2222-4222-8222-222222222222',
            status: 'review_required',
          },
        ],
        has_more: false,
        provider_payload: 'synthetic.provider-private-field',
      },
      200,
    ),
  );
  const { rendered, onBack, onAccount, onReturnToEpisode } = setup(request);
  const view = await rendered;
  await waitFor(() =>
    expect(view.getByText(copy().supportReference(row.support_reference))).toBeOnTheScreen(),
  );
  expect(view.getAllByText(copy().historicalCoins(100))).toHaveLength(2);
  expect(view.getAllByText(copy().recordedAt(row.recorded_at))).toHaveLength(2);
  expect(view.getAllByText(/Recorded .*UTC/)).toHaveLength(2);
  expect(view.getByText(copy().credited)).toBeOnTheScreen();
  expect(view.getByText(copy().reviewRequired)).toBeOnTheScreen();
  expect(view.getByText(copy().historyExplanation)).toBeOnTheScreen();
  expect(view.queryByText('synthetic.provider-private-field')).toBeNull();
  const call = request.mock.calls[0]!;
  expect(requestUrl(call[0])).toBe('https://api.example.test/v1/purchases/history');
  expect(requestHeaders(...call).get('Authorization')).toBe('Bearer mock.synthetic-purchase-owner');
  expect(call[0] instanceof Request ? call[0].method : call[1]?.method).toBe('GET');
  for (const action of view.getAllByRole('button'))
    expect(action).toHaveStyle({ minHeight: minimumTouchTarget });
  await fireEvent.press(view.getByLabelText(englishMessages.common.account));
  await fireEvent.press(view.getByLabelText(englishMessages.wallet.backToEpisode));
  await fireEvent.press(view.getByLabelText(englishMessages.common.back));
  expect(onAccount).toHaveBeenCalledTimes(1);
  expect(onReturnToEpisode).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('labels a bounded history as the latest 20 records', async () => {
  const purchases = Array.from({ length: 20 }, (_, index) => ({
    ...row,
    support_reference: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
  }));
  const request = jest.fn(async () => jsonResponse({ purchases, has_more: true }, 200));
  const view = await setup(request).rendered;
  await waitFor(() => expect(view.getByText(copy().latestOnly)).toBeOnTheScreen());
  expect(view.getAllByText(copy().historicalCoins(100))).toHaveLength(20);
});

it('explains that empty history does not prove failure and asks the viewer to check again', async () => {
  const view = await setup(
    jest.fn(async () => jsonResponse({ purchases: [], has_more: false }, 200)),
  ).rendered;
  await waitFor(() => expect(view.getByText(copy().empty)).toBeOnTheScreen());
  expect(view.getByLabelText(copy().refresh)).toBeEnabled();
});

it.each<[string, unknown]>([
  ['missing rows', {}],
  ['non-array rows', { purchases: {}, has_more: false }],
  ['invalid row', { purchases: [null], has_more: false }],
  ['non-boolean overflow', { ...history, has_more: 'false' }],
  ['inconsistent overflow', { ...history, has_more: true }],
  ['too many rows', { purchases: Array.from({ length: 21 }, () => row), has_more: true }],
  ['duplicate references', { purchases: [row, row], has_more: false }],
  [
    'case-insensitive duplicates',
    {
      purchases: [
        { ...row, support_reference: 'abcdefab-1111-4111-8111-111111111111' },
        { ...row, support_reference: 'ABCDEFAB-1111-4111-8111-111111111111' },
      ],
      has_more: false,
    },
  ],
  ...[-1, 0, 0.5, 2147483648, '100', null].map((coins): [string, unknown] => [
    `invalid coins ${coins}`,
    { ...history, purchases: [{ ...row, historical_credited_coins: coins }] },
  ]),
  ...['provider-transaction-id', '', null].map((reference): [string, unknown] => [
    `invalid reference ${reference}`,
    { ...history, purchases: [{ ...row, support_reference: reference }] },
  ]),
  ...['refunded', '', null].map((status): [string, unknown] => [
    `invalid status ${status}`,
    { ...history, purchases: [{ ...row, status }] },
  ]),
  ...[
    'yesterday',
    '2026-02-30T10:30:00Z',
    '2026-13-01T10:30:00Z',
    '2026-09-09',
    '2026-09-09T10:30:00',
    '2026-09-09T25:30:00Z',
    null,
  ].map((date): [string, unknown] => [
    `invalid date ${date}`,
    { ...history, purchases: [{ ...row, recorded_at: date }] },
  ]),
])('fails closed on %s', async (_label, payload) => {
  const view = await setup(jest.fn(async () => jsonResponse(payload, 200))).rendered;
  await waitFor(() => expect(view.getByText(copy().unavailable)).toBeOnTheScreen());
  expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
});

it.each([403, 404, 500, 503])(
  'uses safe unavailable copy for HTTP %s without reflected provider errors',
  async (status) => {
    const view = await setup(
      jest.fn(async () =>
        jsonResponse(
          { code: 'synthetic.private-code', message: 'synthetic.private-provider-error' },
          status,
        ),
      ),
    ).rendered;
    await waitFor(() => expect(view.getByText(copy().unavailable)).toBeOnTheScreen());
    expect(view.queryByText(/synthetic\.private/)).toBeNull();
  },
);

it('clears old rows during refresh, handles network failure and permits retry', async () => {
  const response = pendingResponse();
  const request = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValueOnce(jsonResponse(history, 200))
    .mockReturnValueOnce(response.promise)
    .mockRejectedValueOnce(new Error('synthetic.private-network-error'))
    .mockResolvedValueOnce(jsonResponse({ purchases: [], has_more: false }, 200));
  const view = await setup(request).rendered;
  await waitFor(() =>
    expect(view.getByText(copy().supportReference(row.support_reference))).toBeOnTheScreen(),
  );
  await fireEvent.press(view.getByLabelText(copy().refresh));
  expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
  expect(view.getByText(copy().loading)).toBeOnTheScreen();
  expect(view.getByLabelText(copy().refresh)).toBeDisabled();
  await act(() => response.resolve(jsonResponse({}, 503)));
  await waitFor(() => expect(view.getByText(copy().unavailable)).toBeOnTheScreen());
  await fireEvent.press(view.getByLabelText(copy().refresh));
  await waitFor(() => expect(view.getByText(copy().unavailable)).toBeOnTheScreen());
  expect(view.queryByText('synthetic.private-network-error')).toBeNull();
  await fireEvent.press(view.getByLabelText(copy().refresh));
  await waitFor(() => expect(view.getByText(copy().empty)).toBeOnTheScreen());
});

it('refreshes on foreground and ignores replaced and unmounted responses', async () => {
  let changeState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') changeState = listener;
    return { remove };
  });
  const previous = pendingResponse();
  const current = pendingResponse();
  const unmounted = pendingResponse();
  const request = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValueOnce(jsonResponse(history, 200))
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise)
    .mockReturnValueOnce(unmounted.promise);
  const view = await setup(request).rendered;
  await waitFor(() =>
    expect(view.getByText(copy().supportReference(row.support_reference))).toBeOnTheScreen(),
  );
  await fireEvent.press(view.getByLabelText(copy().refresh));
  await act(() => {
    changeState('background');
    changeState('active');
  });
  await act(() => current.resolve(jsonResponse({ purchases: [], has_more: false }, 200)));
  await waitFor(() => expect(view.getByText(copy().empty)).toBeOnTheScreen());
  await act(() => previous.resolve(jsonResponse(history, 200)));
  expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
  await fireEvent.press(view.getByLabelText(copy().refresh));
  await view.unmount();
  await act(() => unmounted.resolve(jsonResponse(history, 200)));
  expect(remove).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'immediately hides another account history, with pending refresh: %s',
  async (pending) => {
    const response = pendingResponse();
    const request = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValueOnce(jsonResponse(history, 200))
      .mockReturnValueOnce(response.promise);
    const view = await setup(request).rendered;
    await waitFor(() =>
      expect(view.getByText(copy().supportReference(row.support_reference))).toBeOnTheScreen(),
    );
    if (pending) await fireEvent.press(view.getByLabelText(copy().refresh));
    await act(() => setAuthSession({ credential: 'mock.another-purchase-owner' }));
    expect(view.getByText(copy().sessionChanged)).toBeOnTheScreen();
    expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
    if (pending) await act(() => response.resolve(jsonResponse(history, 200)));
    expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
    expect(view.queryByLabelText(copy().refresh)).toBeNull();
    expect(request).toHaveBeenCalledTimes(pending ? 2 : 1);
  },
);

it('does not request history for signed-out visitors', async () => {
  setAuthSession(null);
  const { rendered, performRequest, onAccount } = setup();
  const view = await rendered;
  expect(performRequest).not.toHaveBeenCalled();
  expect(view.getByText(copy().signIn)).toBeOnTheScreen();
  await fireEvent.press(view.getByLabelText(englishMessages.common.signIn));
  expect(onAccount).toHaveBeenCalledTimes(1);
});

it('clears prior history when the server rejects authentication', async () => {
  const request = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValueOnce(jsonResponse(history, 200))
    .mockResolvedValueOnce(jsonResponse({ message: 'private' }, 401));
  const view = await setup(request).rendered;
  await waitFor(() =>
    expect(view.getByText(copy().supportReference(row.support_reference))).toBeOnTheScreen(),
  );
  await fireEvent.press(view.getByLabelText(copy().refresh));
  await waitFor(() => expect(view.getByText(copy().signIn)).toBeOnTheScreen());
  expect(view.queryByText(copy().supportReference(row.support_reference))).toBeNull();
});
