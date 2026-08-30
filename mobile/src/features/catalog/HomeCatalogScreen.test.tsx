import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import type { CatalogClient, CatalogHome, CatalogRequestOutcome } from '../../api/catalog/types';
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
    client.getHome = async () => {
      calls += 1;
      return originalHome();
    };

    const view = await render(
      <HomeCatalogScreen
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
  });

  it('renders a published featured Harbor Lights series and selects it', async () => {
    const onSelectSeries = jest.fn();
    const view = await render(
      <HomeCatalogScreen
        client={stubClient({ outcome: 'ok', data: harborLightsHome })}
        onOpenHealth={() => {}}
        onOpenSignIn={() => {}}
        onSelectSeries={onSelectSeries}
      />,
    );

    await waitFor(() => expect(view.getByTestId('home-rail-featured')).toBeTruthy());
    expect(view.getByText('Harbor Lights')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);

    await fireEvent.press(view.getByTestId('series-card-ser_harbor'));
    expect(onSelectSeries).toHaveBeenCalledWith('ser_harbor');
  });
});
