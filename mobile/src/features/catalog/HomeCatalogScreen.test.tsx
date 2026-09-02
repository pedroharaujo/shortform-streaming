import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import type { CatalogClient, CatalogHome, CatalogRequestOutcome } from '../../api/catalog/types';
import { expectNoFreeOrLockedBadges } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
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
      code: 'invalid_request',
      message: 'Catalog request is invalid.',
    });
    const originalHome = client.getHome;
    client.getHome = async () => {
      calls += 1;
      return originalHome();
    };

    const view = await render(
      <HomeCatalogScreen client={client} onOpenSignIn={() => {}} onSelectSeries={() => {}} />,
    );

    await waitFor(() => expect(view.getByTestId('home-error')).toBeTruthy());
    expect(view.getByTestId('home-error')).toHaveProp('accessibilityLiveRegion', 'assertive');
    expect(view.getByText('The catalog could not be loaded. Please try again.')).toBeTruthy();
    expect(view.queryByText('Catalog request is invalid.')).toBeNull();
    expect(calls).toBe(1);

    await userEvent.setup().press(view.getByTestId('home-retry'));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('localizes transport failures instead of displaying implementation details', async () => {
    const view = await render(
      <HomeCatalogScreen
        client={stubClient({ outcome: 'unreachable', reason: 'private transport detail' })}
        onOpenSignIn={() => {}}
        onSelectSeries={() => {}}
      />,
    );

    expect(
      await view.findByText('Unable to reach the catalog. Check your connection and try again.'),
    ).toBeTruthy();
    expect(view.queryByText('private transport detail')).toBeNull();
  });

  it('renders a published featured Harbor Lights series and selects it', async () => {
    const onSelectSeries = jest.fn();
    const view = await render(
      <HomeCatalogScreen
        client={stubClient({ outcome: 'ok', data: harborLightsHome })}
        onOpenSignIn={() => {}}
        onSelectSeries={onSelectSeries}
      />,
    );

    await waitFor(() => expect(view.getByTestId('home-rail-featured')).toBeTruthy());
    expect(view.getByText('Harbor Lights')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Featured' })).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
    expect(view.getByTestId('home-sign-in')).toHaveStyle({
      minHeight: minimumTouchTarget,
      minWidth: minimumTouchTarget,
    });
    await fireEvent.press(view.getByTestId('series-card-ser_harbor'));
    expect(onSelectSeries).toHaveBeenCalledWith('ser_harbor');
  });
});
