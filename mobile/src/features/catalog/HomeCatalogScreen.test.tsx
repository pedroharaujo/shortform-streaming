import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import type { CatalogClient, CatalogHome, CatalogRequestOutcome } from '../../api/catalog/types';
import type { AnalyticsRuntime } from '../../analytics/runtime';
import { expectNoFreeOrLockedBadges } from '../../testUtils';
import { HomeCatalogScreen } from './HomeCatalogScreen';

const harborLightsHome: CatalogHome = {
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

function stubClient(home: CatalogRequestOutcome<CatalogHome>): CatalogClient {
  return {
    getHome: async () => home,
    getSeries: async () => ({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    }),
    getEpisode: async () => ({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    }),
  };
}

function analyticsDouble() {
  const logOnce = jest.fn(async () => ({ outcome: 'accepted' as const, eventId: 'evt_test' }));
  return { analytics: { logOnce } as AnalyticsRuntime, logOnce };
}

describe('HomeCatalogScreen', () => {
  it('shows an error and retries the catalog request', async () => {
    let calls = 0;
    const client = stubClient({
      outcome: 'error',
      httpStatus: 400,
      code: 'invalid_request_context',
      message: 'Catalog context is invalid.',
    });
    const originalHome = client.getHome;
    const { analytics, logOnce } = analyticsDouble();
    client.getHome = async () => {
      calls += 1;
      return originalHome();
    };

    const view = await render(
      <HomeCatalogScreen
        analytics={analytics}
        client={client}
        onOpenHealth={() => {}}
        onOpenSignIn={() => {}}
        onSelectSeries={() => {}}
      />,
    );

    await waitFor(() => expect(view.getByTestId('home-error')).toBeTruthy());
    expect(view.getByText('Catalog context is invalid.')).toBeTruthy();
    expect(calls).toBe(1);

    await userEvent.setup().press(view.getByTestId('home-retry'));
    await waitFor(() => expect(calls).toBe(2));
    expect(logOnce).not.toHaveBeenCalled();
  });

  it('renders a published featured Harbor Lights series and selects it', async () => {
    const onSelectSeries = jest.fn();
    const { analytics, logOnce } = analyticsDouble();
    const view = await render(
      <HomeCatalogScreen
        analytics={analytics}
        client={stubClient({ outcome: 'ok', data: harborLightsHome })}
        onOpenHealth={() => {}}
        onOpenSignIn={() => {}}
        onSelectSeries={onSelectSeries}
      />,
    );

    await waitFor(() => expect(view.getByTestId('home-rail-featured')).toBeTruthy());
    expect(view.getByText('Harbor Lights')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
    await waitFor(() => expect(logOnce).toHaveBeenCalledTimes(2));
    expect(logOnce).toHaveBeenNthCalledWith(1, 'home_viewed', 'home', {});
    expect(logOnce).toHaveBeenNthCalledWith(2, 'series_impression', 'i:ser_harbor:0', {
      series_id: 'ser_harbor',
      position: 0,
    });

    await fireEvent.press(view.getByTestId('series-card-ser_harbor'));
    expect(onSelectSeries).toHaveBeenCalledWith('ser_harbor');
  });
});
