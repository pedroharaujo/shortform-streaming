import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import type { CatalogClient, CatalogHome, CatalogRequestOutcome } from '../../api/catalog/types';
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
    const client: CatalogClient = {
      getHome: async () => {
        calls += 1;
        return {
          outcome: 'error',
          httpStatus: 400,
          code: 'invalid_request_context',
          message: 'Catalog context is invalid.',
        };
      },
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
    expect(view.getByText('Featured')).toBeTruthy();
    expect(view.getByText('Harbor Lights')).toBeTruthy();
    expect(
      view.getByText('Synthetic FR-only English microdrama for local catalog tests.'),
    ).toBeTruthy();
    expect(view.getByTestId('catalog-artwork-fallback')).toBeTruthy();
    expect(view.queryByText(/free/i)).toBeNull();
    expect(view.queryByText(/locked/i)).toBeNull();

    await fireEvent.press(view.getByTestId('series-card-ser_harbor'));
    expect(onSelectSeries).toHaveBeenCalledWith('ser_harbor');
  });
});
