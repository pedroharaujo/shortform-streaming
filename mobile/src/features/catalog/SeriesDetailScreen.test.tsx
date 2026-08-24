import type { ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  CatalogClient,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import { SeriesDetailScreen } from './SeriesDetailScreen';

const harborLightsDetail: CatalogSeriesDetail = {
  id: 'ser_harbor',
  title: 'Harbor Lights',
  synopsis: 'Synthetic FR-only English microdrama for local catalog tests.',
  artwork_url: null,
  original_language: 'en',
  genres: [],
  seasons: [
    {
      number: 1,
      episodes: [
        {
          id: 'ep_harbor_1',
          order: 1,
          duration_seconds: 90,
          title: 'Harbor Lights · Episode 1',
          synopsis: 'Synthetic episode synopsis.',
        },
        {
          id: 'ep_harbor_6',
          order: 6,
          duration_seconds: 90,
          title: 'Harbor Lights · Episode 6',
          synopsis: 'Later listed episode.',
        },
      ],
    },
  ],
};

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderSeriesScreen(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

function stubSeriesClient(series: CatalogRequestOutcome<CatalogSeriesDetail>): CatalogClient {
  return {
    getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
    getSeries: async () => series,
    getEpisode: async () => ({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    }),
  };
}

function expectNoFreeOrLockedBadges(view: Awaited<ReturnType<typeof renderSeriesScreen>>): void {
  expect(view.queryAllByText('Free')).toHaveLength(0);
  expect(view.queryAllByText('Locked')).toHaveLength(0);
  expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
  expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
}

describe('SeriesDetailScreen', () => {
  it('shows a loading state before the series resolves', async () => {
    const pending: CatalogClient = {
      getHome: () => new Promise(() => {}),
      getSeries: () => new Promise(() => {}),
      getEpisode: () => new Promise(() => {}),
    };

    const view = await renderSeriesScreen(
      <SeriesDetailScreen
        client={pending}
        onBack={() => {}}
        onSelectEpisode={() => {}}
        seriesId="ser_harbor"
      />,
    );

    expect(view.getByTestId('series-detail-loading')).toBeTruthy();
    expect(view.getByLabelText('Loading series')).toBeTruthy();
    expect(view.queryByTestId('series-detail-loaded')).toBeNull();
  });

  it('shows an error and retries the series request', async () => {
    let calls = 0;
    const client: CatalogClient = {
      getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
      getSeries: async () => {
        calls += 1;
        return {
          outcome: 'error',
          httpStatus: 400,
          code: 'invalid_request_context',
          message: 'Catalog context is invalid.',
        };
      },
      getEpisode: async () => ({
        outcome: 'not-found',
        httpStatus: 404,
        code: 'not_found',
        message: 'Resource not found.',
      }),
    };

    const view = await renderSeriesScreen(
      <SeriesDetailScreen
        client={client}
        onBack={() => {}}
        onSelectEpisode={() => {}}
        seriesId="ser_harbor"
      />,
    );

    expect(await view.findByTestId('series-detail-error')).toBeTruthy();
    expect(view.getByText('Catalog context is invalid.')).toBeTruthy();
    expect(calls).toBe(1);

    await fireEvent.press(view.getByTestId('series-detail-retry'));
    expect(await view.findByTestId('series-detail-error')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('renders published seasons and listed episodes without lock or free inference', async () => {
    const onSelectEpisode = jest.fn();
    const view = await renderSeriesScreen(
      <SeriesDetailScreen
        client={stubSeriesClient({ outcome: 'ok', data: harborLightsDetail })}
        onBack={() => {}}
        onSelectEpisode={onSelectEpisode}
        seriesId="ser_harbor"
      />,
    );

    expect(await view.findByTestId('series-detail-loaded')).toBeTruthy();
    expect(view.getByTestId('series-detail-title')).toHaveTextContent('Harbor Lights');
    expect(
      view.getByText('Synthetic FR-only English microdrama for local catalog tests.'),
    ).toBeTruthy();
    expect(view.getByTestId('series-season-1')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 1')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 6')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_1')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_6')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);

    await fireEvent.press(view.getByTestId('episode-row-ep_harbor_1'));
    await fireEvent.press(view.getByTestId('episode-row-ep_harbor_6'));
    expect(onSelectEpisode).toHaveBeenNthCalledWith(1, 'ep_harbor_1');
    expect(onSelectEpisode).toHaveBeenNthCalledWith(2, 'ep_harbor_6');
  });

  it('shows not-found for an ineligible series, not a locked state', async () => {
    const view = await renderSeriesScreen(
      <SeriesDetailScreen
        client={stubSeriesClient({
          outcome: 'not-found',
          httpStatus: 404,
          code: 'not_found',
          message: 'Resource not found.',
        })}
        onBack={() => {}}
        onSelectEpisode={() => {}}
        seriesId="ser_missing"
      />,
    );

    expect(await view.findByTestId('series-detail-not-found')).toBeTruthy();
    expect(view.getByText('This title is not available.')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
    expect(view.queryByTestId('episode-row-ep_harbor_1')).toBeNull();
    expect(view.queryByTestId('series-detail-loaded')).toBeNull();
  });
});
